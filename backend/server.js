const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const fs = require('fs');
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { requireAuth, optionalAuth } = require('./middleware/auth');
const { personIdForEmail } = require('./people');
const { renderCvToDocxBuffer } = require('./cv/render');
const { docxBufferToPdfBuffer } = require('./cv/pdf');
const { applyJobAdjustments } = require('./cv/adjustments');
const gmailOAuth = require('./gmail/oauth');
const gmailStore = require('./gmail/store');

const MAX_PDF_BUILDS_PER_APPLICATION = 15;
const FRONTEND_URL = 'https://jobs.naoufal-tb.online';

const PORT = process.env.PORT || 3001;

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  path.join(__dirname, 'firebase-service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error(
    `Missing Firebase service account file at ${serviceAccountPath}.\n` +
    'Download it from Firebase Console > Project settings > Service accounts, ' +
    'and set FIREBASE_SERVICE_ACCOUNT_PATH in backend/.env if you placed it elsewhere.'
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath))
});

const db = admin.firestore();

const app = express();
// Read endpoints are guest-public and write endpoints are protected by bearer-token
// auth regardless of origin, so CORS itself doesn't need to be restrictive here -
// reflect the caller's origin rather than pinning to one (which broke local dev and
// would break any future frontend host).
app.use(cors({ origin: true }));

function serveDoc(collection, docId, emptyDefault) {
  return async (req, res) => {
    try {
      const snap = await db.collection(collection).doc(docId).get();

      if (!snap.exists) {
        return res.status(emptyDefault ? 200 : 404).json(emptyDefault ?? { error: 'Not found' });
      }

      res.json(snap.data());
    } catch (err) {
      console.error(`Failed to read ${collection}/${docId}:`, err.message);
      res.status(502).json({ error: 'Data store unavailable' });
    }
  };
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ email: req.user.email, name: req.user.name ?? null });
});

app.get(
  '/api/scraped-data',
  optionalAuth,
  serveDoc('data', 'scraped', {
    scrapedAt: null,
    sourceUrl: null,
    totalRows: 0,
    summary: { perfectMatches: 0, lessThan1000: 0, goodStartups: 0, failedFilters: 0 },
    perfectMatches: [],
    lessThan1000: [],
    goodStartups: [],
    failedCompanies: []
  })
);

app.get(
  '/api/jobs-data',
  optionalAuth,
  serveDoc('data', 'jobs', {
    scrapedAt: null,
    companiesScanned: 0,
    companiesQualifying: 0,
    careersPagesFound: 0,
    jobsFound: 0,
    aiRequirementsEnabled: false,
    jobs: [],
    companies: []
  })
);

app.get(
  '/api/external-jobs',
  optionalAuth,
  serveDoc('data', 'external-jobs', {
    scrapedAt: null,
    keywordsUsed: 0,
    aiRequirementsEnabled: false,
    totalMatches: 0,
    sources: {
      cvbankas: { jobsFound: 0, jobs: [] },
      cvlt: { jobsFound: 0, jobs: [] },
      uzt: { jobsFound: 0, jobs: [] }
    }
  })
);

app.get('/api/scrape-progress', optionalAuth, serveDoc('progress', 'scrape'));
app.get('/api/jobs-progress', optionalAuth, serveDoc('progress', 'jobs'));
app.get('/api/external-jobs-progress', optionalAuth, serveDoc('progress', 'external-jobs'));
app.get('/api/generate-progress', optionalAuth, serveDoc('progress', 'generate'));
app.get('/api/apply-progress', optionalAuth, serveDoc('progress', 'apply'));
app.get('/api/inbox-progress', optionalAuth, serveDoc('progress', 'inbox'));

function requirePerson(req, res, next) {
  const personId = personIdForEmail(req.user.email);
  if (!personId) {
    return res.status(403).json({ error: 'This account has no linked applicant profile' });
  }
  req.personId = personId;
  next();
}

// Signed-in Naoufal/Seif see only their own applications; guests (and anyone without
// a linked profile) see both people's, since this data is meant to be publicly viewable.
app.get('/api/applications', optionalAuth, async (req, res) => {
  try {
    const personId = req.user ? personIdForEmail(req.user.email) : null;

    const query = personId
      ? db.collection('applications').where('personId', '==', personId)
      : db.collection('applications');

    const snap = await query.get();
    const byJobId = {};
    snap.forEach(doc => {
      const { cvJson, ...rest } = doc.data();
      byJobId[personId ? rest.jobId : `${rest.jobId}_${rest.personId}`] = rest;
    });
    res.json({ scope: personId ? 'self' : 'all', applications: byJobId });
  } catch (err) {
    console.error('Failed to read applications:', err.message);
    res.status(502).json({ error: 'Data store unavailable' });
  }
});

async function buildAndSendCvPdf(personId, jobId, res) {
  const docId = `${jobId}_${personId}`;
  const appRef = db.collection('applications').doc(docId);
  const appSnap = await appRef.get();

  if (!appSnap.exists || !appSnap.data().cvGenerated) {
    return res.status(404).json({ error: 'No generated CV for this job yet' });
  }

  const application = appSnap.data();

  if ((application.pdfBuildCount ?? 0) >= MAX_PDF_BUILDS_PER_APPLICATION) {
    return res.status(429).json({ error: 'Generation limit reached for this application' });
  }

  let cv;
  if (application.cvType === 'tailored') {
    cv = application.cvJson;
  } else {
    const profileSnap = await db.collection('profiles').doc(personId).get();
    if (!profileSnap.exists) return res.status(500).json({ error: 'Missing base profile' });
    cv = profileSnap.data();
  }

  cv = applyJobAdjustments(cv, application);

  const docxBuf = await renderCvToDocxBuffer(cv);
  const pdfBuf = await docxBufferToPdfBuffer(docxBuf);

  await appRef.update({ pdfBuildCount: admin.firestore.FieldValue.increment(1), lastBuiltAt: new Date().toISOString() });

  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="${personId}-${application.company}.pdf"`);
  res.send(pdfBuf);
}

app.get('/api/applications/:jobId/cv-pdf', requireAuth, requirePerson, async (req, res) => {
  try {
    await buildAndSendCvPdf(req.personId, req.params.jobId, res);
  } catch (err) {
    console.error('Failed to build CV PDF:', err.message);
    res.status(500).json({ error: 'Failed to build CV' });
  }
});

// Guest-accessible variant with an explicit personId, since there's no session to derive it from.
app.get('/api/applications/:jobId/:personId/cv-pdf', optionalAuth, async (req, res) => {
  try {
    const profileSnap = await db.collection('profiles').doc(req.params.personId).get();
    if (!profileSnap.exists) return res.status(404).json({ error: 'Unknown person' });
    await buildAndSendCvPdf(req.params.personId, req.params.jobId, res);
  } catch (err) {
    console.error('Failed to build CV PDF:', err.message);
    res.status(500).json({ error: 'Failed to build CV' });
  }
});

app.get('/api/gmail/status', requireAuth, requirePerson, async (req, res) => {
  try {
    const connection = await gmailStore.getConnection(req.personId);
    res.json({
      connected: Boolean(connection),
      email: connection?.email ?? null,
      connectedAt: connection?.connectedAt ?? null
    });
  } catch (err) {
    console.error('Failed to read Gmail connection status:', err.message);
    res.status(502).json({ error: 'Data store unavailable' });
  }
});

// Returns the auth URL rather than redirecting directly, since this call needs the
// Bearer token header (to know who's connecting) - a plain link click can't send one.
// The frontend fetches this, then navigates the browser to the returned URL itself.
app.get('/api/gmail/connect-url', requireAuth, requirePerson, (req, res) => {
  res.json({ url: gmailOAuth.buildAuthUrl(req.personId) });
});

// Google redirects here directly (no Authorization header) - the person is identified
// by `state`, which we set server-side in /api/gmail/connect from the authenticated
// session, so it isn't attacker-controlled.
app.get('/api/gmail/callback', async (req, res) => {
  const { code, state: personId, error } = req.query;

  if (error || !code || !personId) {
    return res.redirect(`${FRONTEND_URL}/?gmail=error`);
  }

  try {
    const tokens = await gmailOAuth.exchangeCodeForTokens(code);
    const email = await gmailOAuth.fetchGmailAddress(tokens.access_token);

    await gmailStore.setConnection(personId, {
      email,
      refreshToken: tokens.refresh_token,
      connectedAt: new Date().toISOString()
    });

    res.redirect(`${FRONTEND_URL}/?gmail=connected`);
  } catch (err) {
    console.error('Gmail OAuth callback failed:', err.message);
    res.redirect(`${FRONTEND_URL}/?gmail=error`);
  }
});

app.post('/api/gmail/disconnect', requireAuth, requirePerson, async (req, res) => {
  try {
    await gmailStore.removeConnection(req.personId);
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to disconnect Gmail:', err.message);
    res.status(502).json({ error: 'Data store unavailable' });
  }
});

app.get('/api/notifications', requireAuth, requirePerson, async (req, res) => {
  try {
    // Sorted in-memory rather than via .orderBy() to avoid needing a composite Firestore
    // index for this personId + createdAt combination; notification volume is small.
    const snap = await db.collection('notifications').where('personId', '==', req.personId).get();
    const notifications = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 50);

    res.json(notifications);
  } catch (err) {
    console.error('Failed to read notifications:', err.message);
    res.status(502).json({ error: 'Data store unavailable' });
  }
});

app.post('/api/notifications/:id/read', requireAuth, requirePerson, async (req, res) => {
  try {
    const ref = db.collection('notifications').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists || snap.data().personId !== req.personId) {
      return res.status(404).json({ error: 'Not found' });
    }
    await ref.update({ read: true });
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to mark notification read:', err.message);
    res.status(502).json({ error: 'Data store unavailable' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend listening on :${PORT}`);
});
