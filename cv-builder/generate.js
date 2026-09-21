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
    careersUrl: job.careersUrl,
    cvGenerated: true,
    applied: false,
    appliedAt: null,
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

async function run() {
  const limit = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
  const snap = await getDb().collection('data').doc('jobs').get();
  if (!snap.exists) throw new Error('No data/jobs doc found in Firestore.');

  const jobs = snap.data().jobs || [];
  console.log(`Loaded ${jobs.length} jobs.`);

  let processed = 0;
  let generated = 0;
  let skipped = 0;

  for (const job of jobs) {
    if (processed >= limit) break;
    const id = job.id || jobId(job.company, job.applyUrl);

    for (const personId of PEOPLE) {
      const result = await generateForJobAndPerson(job, id, personId);
      if (result.skipped) {
        skipped++;
        console.log(`[skip] ${job.company} / ${job.title} (${personId}) — ${result.reason}`);
      } else {
        generated++;
        console.log(
          `[generated] ${job.company} / ${job.title} (${personId}) — ${result.cvType}` +
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
