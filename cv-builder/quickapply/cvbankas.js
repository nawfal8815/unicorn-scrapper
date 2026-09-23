// CVbankas native "Send CV" quick-apply automation. Uses a real Chromium (via
// playwright-core, not the full playwright package - the bundled-browser download
// doesn't support the Oracle VPS's Ubuntu20.04-arm64) driven with a logged-in session
// captured by capture-session.js. Never touches a password.
//
// Deliberately does NOT swap/tailor the CV per job here: CVbankas ties every native
// application to whichever CV is currently marked "Active" on the account, and their
// only per-application CV-file-upload path (the AI importer) is capped at 5/day - the
// user chose to keep one CV active and rely on the cover letter for personalization here.
//
// Not every CVbankas listing uses the native apply flow - some redirect to the
// employer's own external ATS on click. Those are skipped and flagged, not attempted:
// generic-ATS form-filling is a separate, not-yet-built piece of automation.

const path = require('path');
const { chromium } = require('playwright-core');
const { getDb } = require('../../scraper/firestore');
const { getProfile } = require('../profiles');
const { generateCoverLetter } = require('../coverletter');
const { createProgressWriter } = require('../../scraper/progress');

const PEOPLE = ['naoufal', 'seif'];
const MAX_APPLIES_PER_RUN = Number(process.env.MAX_CVBANKAS_APPLIES_PER_RUN || 15);
const CHROMIUM_PATH = process.env.CHROMIUM_EXECUTABLE_PATH || '/snap/bin/chromium';
const STORAGE_STATE_DIR = path.join(__dirname, 'storage-state');
const NATIVE_APPLY_PATTERN = /\/kandidatuoti-pagal-skelbima-/;

const progress = createProgressWriter('cvbankas-apply');

function storageStatePath(personId) {
  return path.join(STORAGE_STATE_DIR, `cvbankas-${personId}.json`);
}

async function loadCandidates(personId) {
  const snap = await getDb()
    .collection('applications')
    .where('source', '==', 'cvbankas')
    .where('personId', '==', personId)
    .get();

  const candidates = [];
  snap.forEach(doc => {
    const data = doc.data();
    // Same claim-before-act idempotency rule as email sending: never auto-retry a job
    // that's already claimed or applied, even on crash recovery - needs a human look.
    if (data.applyUrl && !data.cvbankasApplied && !data.cvbankasApplyStartedAt) {
      candidates.push({ docId: doc.id, ...data });
    }
  });
  return candidates;
}

async function claimForApply(docId) {
  const ref = getDb().collection('applications').doc(docId);
  return getDb().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (!data || data.cvbankasApplied || data.cvbankasApplyStartedAt) return false;
    tx.update(ref, { cvbankasApplyStartedAt: new Date().toISOString() });
    return true;
  });
}

async function applyToOne(page, application, profile) {
  await page.goto(application.applyUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

  const sendCvButton = page.getByText(/Siųsti CV|Send CV/i).first();
  if (!(await sendCvButton.count())) {
    return { outcome: 'skipped', reason: 'no-apply-button-found' };
  }
  await sendCvButton.click();
  await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {});

  if (!NATIVE_APPLY_PATTERN.test(page.url())) {
    return { outcome: 'skipped', reason: 'external-ats-redirect', redirectedTo: page.url() };
  }

  const coverLetter = await generateCoverLetter(profile, {
    title: application.jobTitle,
    company: application.company,
    requirements: application.requirements
  }).catch(() => null);

  if (coverLetter) {
    const textarea = page.locator('textarea').first();
    if (await textarea.count()) {
      await textarea.fill(coverLetter.slice(0, 3000));
    }
  }

  const consentCheckbox = page.locator('input[type=checkbox]').first();
  if (await consentCheckbox.count()) {
    await consentCheckbox.check();
  }

  const submitButton = page.getByRole('button', { name: /^Siųsti$|^Send$/i }).first();
  if (!(await submitButton.count())) {
    return { outcome: 'failed', reason: 'submit-button-not-found' };
  }
  await submitButton.click();
  await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {});

  return { outcome: 'applied', coverLetterUsed: coverLetter ?? null };
}

async function runForPerson(browser, personId, stats) {
  const statePath = storageStatePath(personId);
  const fs = require('fs');
  if (!fs.existsSync(statePath)) {
    console.log(`[skip-person] ${personId} - no captured session at ${statePath}. Run capture-session.js first.`);
    return;
  }

  const candidates = await loadCandidates(personId);
  console.log(`${personId}: ${candidates.length} CVbankas applications ready.`);
  if (candidates.length === 0) return;

  const profile = await getProfile(personId);
  const context = await browser.newContext({ storageState: statePath });
  const page = await context.newPage();

  for (const application of candidates) {
    if (stats.applied >= MAX_APPLIES_PER_RUN) {
      console.log(`Reached MAX_CVBANKAS_APPLIES_PER_RUN (${MAX_APPLIES_PER_RUN}), stopping.`);
      break;
    }

    const claimed = await claimForApply(application.docId);
    if (!claimed) {
      console.log(`[skip] ${application.company} / ${application.jobTitle} (${personId}) - already claimed, not retrying`);
      continue;
    }

    try {
      const result = await applyToOne(page, application, profile);

      if (result.outcome === 'applied') {
        await getDb().collection('applications').doc(application.docId).update({
          cvbankasApplied: true,
          cvbankasAppliedAt: new Date().toISOString(),
          cvbankasCoverLetterUsed: result.coverLetterUsed
        });
        stats.applied++;
        console.log(`[applied] ${application.company} / ${application.jobTitle} (${personId})`);
      } else if (result.outcome === 'skipped') {
        await getDb().collection('applications').doc(application.docId).update({
          cvbankasSkipped: true,
          cvbankasSkipReason: result.reason
        });
        stats.skipped++;
        console.log(`[skip] ${application.company} / ${application.jobTitle} (${personId}) - ${result.reason}`);
      } else {
        await getDb().collection('applications').doc(application.docId).update({
          cvbankasApplyFailed: true,
          cvbankasApplyError: result.reason
        });
        stats.failed++;
        console.log(`[failed] ${application.company} / ${application.jobTitle} (${personId}) - ${result.reason} - needs manual review`);
      }
    } catch (err) {
      // Deliberately NOT clearing cvbankasApplyStartedAt - if the click actually went
      // through and only a later step (Firestore write, cover-letter generation) threw,
      // clearing the claim would let a future run submit a genuine duplicate application.
      await getDb().collection('applications').doc(application.docId).update({
        cvbankasApplyFailed: true,
        cvbankasApplyError: err.message
      }).catch(() => {});
      stats.failed++;
      console.error(`[failed] ${application.company} / ${application.jobTitle} (${personId}): ${err.message} - needs manual review before retrying`);
    }

    stats.processed++;
    progress.write({
      status: 'running',
      total: stats.total,
      processed: stats.processed,
      applied: stats.applied,
      skipped: stats.skipped,
      failed: stats.failed,
      percent: Math.round((stats.processed / stats.total) * 100)
    });

    await page.waitForTimeout(3000 + Math.random() * 5000);
  }

  await context.close();
}

async function run() {
  const stats = { total: 0, processed: 0, applied: 0, skipped: 0, failed: 0 };
  const perPersonCandidates = {};
  for (const personId of PEOPLE) {
    perPersonCandidates[personId] = await loadCandidates(personId);
    stats.total += perPersonCandidates[personId].length;
  }

  if (stats.total === 0) {
    console.log('No CVbankas applications ready to send.');
    progress.write({ status: 'done', total: 0, processed: 0, applied: 0, skipped: 0, failed: 0, percent: 100 });
    return;
  }

  progress.write({ status: 'running', total: stats.total, processed: 0, applied: 0, skipped: 0, failed: 0, percent: 0 });

  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox']
  });

  try {
    for (const personId of PEOPLE) {
      await runForPerson(browser, personId, stats);
    }
  } finally {
    await browser.close();
  }

  progress.write({
    status: 'done',
    total: stats.total,
    processed: stats.processed,
    applied: stats.applied,
    skipped: stats.skipped,
    failed: stats.failed,
    percent: 100
  });

  console.log(`\nDone. Applied: ${stats.applied}, skipped: ${stats.skipped}, failed: ${stats.failed}.`);
}

run().catch(err => {
  console.error('Failed:', err);
  progress.write({ status: 'error', message: err.message, total: 0, processed: 0, applied: 0, skipped: 0, failed: 0, percent: 0 });
  process.exitCode = 1;
});
