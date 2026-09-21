const { execFile } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const PIPELINE = [
  'scraper/scrape.js',
  'scraper/job-scraper.js',
  'scraper/external-jobs-scraper.js',
  'cv-builder/generate.js'
];

function runScript(scriptPath) {
  return new Promise(resolve => {
    console.log(`\n=== Running ${scriptPath} ===`);

    const child = execFile('node', ['--env-file=.env', scriptPath], {
      cwd: ROOT,
      maxBuffer: 1024 * 1024 * 100
    });

    child.stdout.on('data', d => process.stdout.write(d));
    child.stderr.on('data', d => process.stderr.write(d));

    child.on('exit', code => {
      console.log(`=== ${scriptPath} exited with code ${code} ===`);
      resolve(code);
    });

    child.on('error', err => {
      console.error(`Failed to start ${scriptPath}:`, err.message);
      resolve(1);
    });
  });
}

async function runPipeline() {
  const startedAt = new Date();
  console.log(`\n########## Daily pipeline started at ${startedAt.toISOString()} ##########`);

  for (const script of PIPELINE) {
    const code = await runScript(script);
    if (code !== 0) {
      console.error(`Step ${script} exited non-zero (${code}) - continuing to the next step anyway.`);
    }
  }

  const finishedAt = new Date();
  const minutes = Math.round((finishedAt - startedAt) / 60000);
  console.log(`\n########## Daily pipeline finished at ${finishedAt.toISOString()} (${minutes} min) ##########`);
}

function msUntilNextMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - now.getTime();
}

async function loop() {
  console.log('Daily runner starting - running the pipeline once now, then aligning to midnight.');
  await runPipeline();

  for (;;) {
    const waitMs = msUntilNextMidnight();
    const wakeAt = new Date(Date.now() + waitMs);
    console.log(
      `\nSleeping until ${wakeAt.toISOString()} (${Math.round(waitMs / 60000)} min from now)...`
    );
    await new Promise(resolve => setTimeout(resolve, waitMs));
    await runPipeline();
  }
}

loop().catch(err => {
  console.error('Daily runner crashed:', err);
  process.exit(1);
});
