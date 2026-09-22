const { getDb } = require('../scraper/firestore');
const { renderCvToDocxBuffer } = require('../backend/cv/render');
const { docxBufferToPdfBuffer } = require('../backend/cv/pdf');
const { sendEmail } = require('../backend/gmail/send');
const { getConnection } = require('../backend/gmail/store');
const { getProfile } = require('./profiles');
const { generateCoverLetter } = require('./coverletter');
const { applyJobAdjustments } = require('../backend/cv/adjustments');
const { createProgressWriter } = require('../scraper/progress');

const progress = createProgressWriter('apply');
const MAX_SENDS_PER_RUN = Number(process.env.MAX_SENDS_PER_RUN || 20);

async function loadCandidates() {
  const snap = await getDb()
    .collection('applications')
    .where('cvGenerated', '==', true)
    .where('applied', '==', false)
    .get();

  const candidates = [];
  snap.forEach(doc => {
    const data = doc.data();
    // sendingStartedAt means a previous run already claimed this one - either it's
    // still in flight (shouldn't happen within one run, but guards concurrent runs)
    // or a previous run crashed mid-send. Either way, NEVER auto-retry: a crash could
    // mean the email genuinely went out before the crash. Needs a human to clear it.
    if (data.applicationEmail && !data.sendingStartedAt) {
      candidates.push({ docId: doc.id, ...data });
    }
  });
  return candidates;
}

// Atomically claims this application for sending, so a crash between "send succeeded"
// and "mark applied" can never result in a second run re-sending the same email.
// Returns false if it's already been claimed (by this run or a previous one).
async function claimForSending(docId) {
  const ref = getDb().collection('applications').doc(docId);
  return getDb().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (!data || data.applied || data.sendingStartedAt) return false;
    tx.update(ref, { sendingStartedAt: new Date().toISOString() });
    return true;
  });
}

async function buildCvPdf(application) {
  const baseCv = application.cvType === 'tailored' ? application.cvJson : await getProfile(application.personId);
  const cv = applyJobAdjustments(baseCv, application);
  const docxBuf = await renderCvToDocxBuffer(cv);
  return docxBufferToPdfBuffer(docxBuf);
}

async function applyToOne(application, connection) {
  const pdfBuf = await buildCvPdf(application);

  const profile = await getProfile(application.personId);
  const coverLetter = await generateCoverLetter(profile, {
    title: application.jobTitle,
    company: application.company,
    requirements: application.requirements
  });

  const bodyText =
    coverLetter ??
    `Hello,\n\nI'd like to apply for the ${application.jobTitle} position at ${application.company}. ` +
    `Please find my CV attached.\n\nBest regards,\n${profile.name.split(' ')[0]}`;

  const result = await sendEmail({
    refreshToken: connection.refreshToken,
    fromEmail: connection.email,
    to: application.applicationEmail,
    subject: `Application: ${application.jobTitle} - ${profile.name}`,
    bodyText,
    attachment: {
      filename: `${profile.name.replace(/\s+/g, '_')}_CV.pdf`,
      buffer: pdfBuf
    }
  });

  await getDb().collection('applications').doc(application.docId).update({
    applied: true,
    appliedAt: new Date().toISOString(),
    emailSent: true,
    coverLetterUsed: bodyText,
    gmailThreadId: result.threadId
  });
}

async function run() {
  const dryRun = process.env.DRY_RUN === '1';
  const candidates = await loadCandidates();
  console.log(`Found ${candidates.length} applications ready to send (have an application email, not yet applied).`);
  if (dryRun) console.log('DRY_RUN=1 - will not actually send any emails.');

  const connectionCache = {};
  let sent = 0;
  let skippedNoConnection = 0;
  let failed = 0;
  let processed = 0;

  progress.write({ status: 'running', total: candidates.length, sent: 0, failed: 0, percent: 0 });

  for (const application of candidates) {
    if (sent >= MAX_SENDS_PER_RUN) {
      console.log(`Reached MAX_SENDS_PER_RUN (${MAX_SENDS_PER_RUN}), stopping.`);
      break;
    }

    if (!(application.personId in connectionCache)) {
      connectionCache[application.personId] = await getConnection(application.personId);
    }
    const connection = connectionCache[application.personId];

    if (!connection) {
      skippedNoConnection++;
      console.log(`[skip] ${application.company} / ${application.jobTitle} (${application.personId}) - Gmail not connected`);
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] would send to ${application.applicationEmail} for ${application.company} / ${application.jobTitle} (${application.personId})`);
      sent++;
      processed++;
      continue;
    }

    const claimed = await claimForSending(application.docId);
    if (!claimed) {
      console.log(`[skip] ${application.company} / ${application.jobTitle} (${application.personId}) - already claimed by another run, not retrying`);
      continue;
    }

    try {
      await applyToOne(application, connection);
      console.log(`[sent] ${application.company} / ${application.jobTitle} (${application.personId}) -> ${application.applicationEmail}`);
      sent++;
    } catch (err) {
      failed++;
      // Deliberately NOT clearing sendingStartedAt: if the send actually went through
      // and only the follow-up Firestore write failed, clearing it would let a future
      // run send a genuine duplicate. This one now needs a human to check Sent mail and
      // clear it manually before it can be retried.
      await getDb().collection('applications').doc(application.docId).update({ sendFailed: true, sendError: err.message }).catch(() => {});
      console.error(`[failed] ${application.company} / ${application.jobTitle} (${application.personId}): ${err.message} - needs manual review before retrying`);
    }

    processed++;
    progress.write({
      status: 'running',
      total: candidates.length,
      sent,
      failed,
      percent: Math.round((processed / candidates.length) * 100)
    });
  }

  progress.write({ status: 'done', total: candidates.length, sent, failed, percent: 100 });

  console.log(`\nDone. Sent: ${sent}, failed: ${failed}, skipped (no Gmail connection): ${skippedNoConnection}.`);
}

run().catch(err => {
  console.error('Failed:', err);
  progress.write({ status: 'error', message: err.message, total: 0, sent: 0, failed: 0, percent: 0 });
  process.exitCode = 1;
});
