const { getDb } = require('../scraper/firestore');
const { jobId } = require('../scraper/job-id');
const { getProfile } = require('./profiles');
const { tailorCvForJob } = require('./tailor');
const { getApplication, setApplication } = require('./applications');

const PEOPLE = ['naoufal', 'seif'];

async function generateForJobAndPerson(job, id, personId) {
  const existing = await getApplication(id, personId);
  if (existing) {
    return { skipped: true, reason: existing.applied ? 'already-applied' : 'already-generated' };
  }

  const hasRequirements = Array.isArray(job.requirements) && job.requirements.length > 0;

  const base = {
    company: job.company,
    jobTitle: job.title,
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

  let processed = 0;
  let generated = 0;
  let skipped = 0;

  for (const job of jobs) {
    if (processed >= limit) break;
    const id = job.id || jobId(job.company ?? job.sourceLabel, job.applyUrl);

    for (const personId of PEOPLE) {
      const result = await generateForJobAndPerson(job, id, personId);
      if (result.skipped) {
        skipped++;
        console.log(`[skip] (${job.sourceLabel}) ${job.company} / ${job.title} (${personId}) — ${result.reason}`);
      } else {
        generated++;
        console.log(
          `[generated] (${job.sourceLabel}) ${job.company} / ${job.title} (${personId}) — ${result.cvType}` +
          (result.addedSkills.length ? ` — added: ${result.addedSkills.join(', ')}` : '')
        );
      }
    }

    processed++;
  }

  console.log(`\nDone. Jobs processed: ${processed}, applications generated: ${generated}, skipped: ${skipped}.`);
}

run().catch(err => {
  console.error('Failed:', err);
  process.exitCode = 1;
});
