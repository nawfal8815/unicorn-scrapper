const fs = require('fs');
const path = require('path');
const { tailorCvForJob } = require('./tailor');
const { renderCvToDocxBuffer } = require('../backend/cv/render');

const SAMPLE_JOB = {
  title: 'QA Automation Engineer',
  company: 'Example Startup',
  requirements: [
    'Experience with Cypress for end-to-end testing',
    'Familiarity with Postman for API testing',
    'Knowledge of Jira for bug tracking',
    'Experience with CI/CD pipelines',
    'Strong understanding of SQL'
  ]
};

async function main() {
  const baseCv = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'naoufal.json'), 'utf8'));
  const { cv, addedSkills } = await tailorCvForJob(baseCv, SAMPLE_JOB);

  console.log('Added skills:', addedSkills);

  const outDir = path.join(__dirname, 'output', '_test');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'naoufal-tailored.json'), JSON.stringify(cv, null, 2));

  const buf = await renderCvToDocxBuffer(cv);
  fs.writeFileSync(path.join(outDir, 'naoufal-tailored.docx'), buf);
  console.log('wrote naoufal-tailored.docx');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
