const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const fs = require('fs');
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { requireAuth } = require('./middleware/auth');

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
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true }));

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
  requireAuth,
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
  requireAuth,
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
  requireAuth,
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

app.get('/api/scrape-progress', requireAuth, serveDoc('progress', 'scrape'));
app.get('/api/jobs-progress', requireAuth, serveDoc('progress', 'jobs'));
app.get('/api/external-jobs-progress', requireAuth, serveDoc('progress', 'external-jobs'));

app.listen(PORT, () => {
  console.log(`Backend listening on :${PORT}`);
});
