const { getDb } = require('../scraper/firestore');
const { jobId } = require('../scraper/job-id');
const { getProfile } = require('./profiles');
const { tailorCvForJob } = require('./tailor');
const { getApplication, setApplication } = require('./applications');
const { createProgressWriter } = require('../scraper/progress');

const PEOPLE = ['naoufal', 'seif'];
const progress = createProgressWriter('generate');

async function generateForJobAndPerson(job, id, personId) {
  const existing = await getApplication(id, personId);
  if (existing) {
    // The CV itself is never regenerated (no need to re-run AI), but cheap fields that
    // weren't extractable on an earlier scrape - most importantly applicationEmail, which
    // apply.js needs to actually send anything - should still get backfilled when a fresher
    // scrape finds them, rather than staying null forever just because a record already exists.
    const freshEmail = job.applicationEmail ?? null;
    const freshRequirements = job.requirements ?? [];
    const freshSubtitle = job.subtitle ?? null;
    const emailNewlyFound = !existing.applicationEmail && freshEmail;
    const requirementsNewlyFound = (!existing.requirements || existing.requirements.length === 0) && freshRequirements.length > 0;
    const subtitleNewlyFound = !existing.subtitle && freshSubtitle;

    if (emailNewlyFound || requirementsNewlyFound || subtitleNewlyFound) {
      const patch = {};
      if (emailNewlyFound) patch.applicationEmail = freshEmail;
      if (requirementsNewlyFound) patch.requirements = freshRequirements;
      if (subtitleNewlyFound) patch.subtitle = freshSubtitle;
      await setApplication(id, personId, patch);
      return { skipped: true, reason: 'already-generated', backfilled: Object.keys(patch) };
    }

    return { skipped: true, reason: existing.applied ? 'already-applied' : 'already-generated' };
  }

  const hasRequirements = Array.isArray(job.requirements) && job.requirements.length > 0;

  const base = {
    company: job.company,
    jobTitle: job.title,
    subtitle: job.subtitle ?? null,
    applyUrl: job.applyUrl,
    careersUrl: job.careersUrl ?? null,
    applicationEmail: job.applicationEmail ?? null,
    requirements: job.requirements ?? [],
    source: job.sourceLabel ?? 'career-page',
    cvGenerated: true,
    applied: false,
    appliedAt: null,
    emailSent: false,
    pdfBuildCount: 0
  };

  if (!hasRequirements) {
    await setApplication(id, personId, { ...base, cvType: 'standard-qa', cvJson: null, addedSkills: [] });
    return { skipped: false, cvType: 'standard-qa', addedSkills: [] };
  }

  const baseCv = await getProfile(personId);
  const { cv, addedSkills } = await tailorCvForJob(baseCv, {
    title: job.title,
    company: job.company,
    requirements: job.requirements
  });

  await setApplication(id, personId, { ...base, cvType: 'tailored', cvJson: cv, addedSkills });
  return { skipped: false, cvType: 'tailored', addedSkills };
}

async function loadAllJobs() {
  const db = getDb();
  const [jobsSnap, externalSnap] = await Promise.all([
    db.collection('data').doc('jobs').get(),
    db.collection('data').doc('external-jobs').get()
  ]);

  const jobs = [];

  if (jobsSnap.exists) {
    for (const job of jobsSnap.data().jobs || []) {
      jobs.push({ ...job, sourceLabel: 'career-page' });
    }
  }

  if (externalSnap.exists) {
    const sources = externalSnap.data().sources || {};
    for (const [sourceLabel, source] of Object.entries(sources)) {
      for (const job of source.jobs || []) {
        jobs.push({ ...job, sourceLabel });
      }
    }
  }

  return jobs;
}

async function run() {
  const limit = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
  const jobs = await loadAllJobs();

  if (jobs.length === 0) throw new Error('No jobs found in data/jobs or data/external-jobs.');
  console.log(`Loaded ${jobs.length} jobs (career pages + external boards).`);

  const totalJobs = Math.min(jobs.length, limit === Infinity ? jobs.length : limit);

  let processed = 0;
  let generated = 0;
  let skipped = 0;

  progress.write({
    status: 'running',
    totalJobs,
    processed: 0,
    generated: 0,
    skipped: 0,
    currentCompany: null,
    percent: 0
  });

  for (const job of jobs) {
    if (processed >= limit) break;
    const id = job.id || jobId(job.company ?? job.sourceLabel, job.applyUrl);

    for (const personId of PEOPLE) {
      const result = await generateForJobAndPerson(job, id, personId);
      if (result.skipped) {
        skipped++;
        const backfillNote = result.backfilled ? ` — backfilled: ${result.backfilled.join(', ')}` : '';
        console.log(`[skip] (${job.sourceLabel}) ${job.company} / ${job.title} (${personId}) — ${result.reason}${backfillNote}`);
      } else {
        generated++;
        console.log(
          `[generated] (${job.sourceLabel}) ${job.company} / ${job.title} (${personId}) — ${result.cvType}` +
          (result.addedSkills.length ? ` — added: ${result.addedSkills.join(', ')}` : '')
        );
      }

      progress.pushRecent({
        company: job.company,
        jobTitle: job.title,
        personId,
        skipped: result.skipped,
        cvType: result.cvType ?? null,
        addedSkills: result.addedSkills ?? []
      });
    }

    processed++;

    progress.write({
      status: 'running',
      totalJobs,
      processed,
      generated,
      skipped,
      currentCompany: job.company,
      percent: Math.round((processed / totalJobs) * 100)
    });
  }

  progress.write({
    status: 'done',
    totalJobs,
    processed,
    generated,
    skipped,
    currentCompany: null,
    percent: 100
  });

  console.log(`\nDone. Jobs processed: ${processed}, applications generated: ${generated}, skipped: ${skipped}.`);
}

run().catch(err => {
  console.error('Failed:', err);
  progress.write({
    status: 'error',
    message: err.message,
    totalJobs: 0,
    processed: 0,
    generated: 0,
    skipped: 0,
    currentCompany: null,
    percent: 0
  });
  process.exitCode = 1;
});
