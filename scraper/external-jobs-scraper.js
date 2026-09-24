// playwright-core (not the full playwright package) - this runs on the Oracle VPS, whose
// ARM64 Ubuntu 20.04 image has no working bundled-Chromium download from Playwright; the
// snap-installed Chromium at CHROMIUM_EXECUTABLE_PATH is what actually works there. Also
// runs fine locally/elsewhere by pointing the env var at any real Chrome/Chromium install.
const { chromium } = require('playwright-core');
const { PHRASES } = require('./keywords');
const { createProgressWriter } = require('./progress');
const { writeDoc } = require('./firestore');
const { extractRequirementsFromPage, OPENAI_KEY } = require('./ai');
const { scrapeCvbankas } = require('./sites/cvbankas');
const { scrapeCvLt } = require('./sites/cvlt');
const { scrapeUzt } = require('./sites/uzt');
const { jobId } = require('./job-id');

const progress = createProgressWriter('external-jobs');
const STAGES = ['cvbankas', 'cvlt', 'uzt', 'requirements'];
const STAGE_WEIGHT = 100 / STAGES.length;

function stagePercent(stageIndex, current, total) {
  const within = total > 0 ? current / total : 0;
  return Math.round(stageIndex * STAGE_WEIGHT + within * STAGE_WEIGHT);
}

function writeStageProgress(stageIndex, stage, current, total, totalMatches, currentItem) {
  progress.write({
    status: 'running',
    stage,
    stageProgress: { current, total },
    totalMatches,
    currentItem: currentItem ?? null,
    percent: stagePercent(stageIndex, current, total)
  });
}

async function enrichWithRequirements(page, allJobs, stageIndex) {
  if (!OPENAI_KEY) return;

  for (let i = 0; i < allJobs.length; i++) {
    allJobs[i].requirements = await extractRequirementsFromPage(page, allJobs[i].applyUrl).catch(
      () => null
    );

    if (i % 5 === 0 || i === allJobs.length - 1) {
      writeStageProgress(stageIndex, 'requirements', i + 1, allJobs.length, allJobs.length, allJobs[i].title);
    }
  }
}

async function run() {
  const keywords = process.env.LIMIT ? PHRASES.slice(0, Number(process.env.LIMIT)) : PHRASES;

  console.log(`Loaded ${keywords.length} keywords.`);
  console.log(
    OPENAI_KEY
      ? 'OpenAI key detected - requirements extraction enabled.'
      : 'No OpenAI key found - skipping requirements extraction.'
  );

  progress.write({
    status: 'running',
    stage: 'cvbankas',
    stageProgress: { current: 0, total: keywords.length },
    totalMatches: 0,
    currentItem: null,
    percent: 0
  });

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/snap/bin/chromium',
    headless: process.env.HEADFUL !== '1',
    args: ['--no-sandbox']
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  await page.route('**/*', route => {
    const type = route.request().resourceType();
    if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  console.log('\n--- CVbankas ---');
  let cvbankasRunningCount = 0;
  const cvbankasJobs = await scrapeCvbankas(page, keywords, {
    onKeyword: (keyword, newMatches) => {
      cvbankasRunningCount += newMatches;
      writeStageProgress(0, 'cvbankas', keywords.indexOf(keyword) + 1, keywords.length, cvbankasRunningCount, keyword);
      if (newMatches) console.log(`  [${keyword}] +${newMatches}`);
    }
  }).catch(err => {
    console.error('CVbankas scrape failed:', err.message);
    return [];
  });
  console.log(`CVbankas total: ${cvbankasJobs.length} matches`);

  console.log('\n--- CV.lt ---');
  let cvltRunningCount = 0;
  const cvltJobs = await scrapeCvLt(page, keywords, {
    onKeyword: (keyword, newMatches) => {
      cvltRunningCount += newMatches;
      writeStageProgress(1, 'cvlt', keywords.indexOf(keyword) + 1, keywords.length, cvltRunningCount, keyword);
      if (newMatches) console.log(`  [${keyword}] +${newMatches}`);
    }
  }).catch(err => {
    console.error('CV.lt scrape failed:', err.message);
    return [];
  });
  console.log(`CV.lt total: ${cvltJobs.length} matches`);

  console.log('\n--- Uzimtumo tarnyba ---');
  const uztJobs = await scrapeUzt(page, {
    onProgress: (pageIndex, matchesSoFar) => {
      writeStageProgress(2, 'uzt', pageIndex, 90, matchesSoFar, `page ${pageIndex}`);
      console.log(`  page ${pageIndex}: ${matchesSoFar} matches so far`);
    }
  }).catch(err => {
    console.error('Uzt scrape failed:', err.message);
    return [];
  });
  console.log(`Uzimtumo tarnyba total: ${uztJobs.length} matches`);

  console.log('\n--- Extracting requirements (CVbankas + CV.lt) ---');
  await enrichWithRequirements(page, cvbankasJobs, 3);
  await enrichWithRequirements(page, cvltJobs, 3);

  await context.close();
  await browser.close();

  const totalMatches = cvbankasJobs.length + cvltJobs.length + uztJobs.length;

  for (const job of [...cvbankasJobs, ...cvltJobs, ...uztJobs]) {
    job.id = jobId(job.company ?? job.source, job.applyUrl);
  }

  const output = {
    scrapedAt: new Date().toISOString(),
    keywordsUsed: keywords.length,
    aiRequirementsEnabled: Boolean(OPENAI_KEY),
    totalMatches,
    sources: {
      cvbankas: { jobsFound: cvbankasJobs.length, jobs: cvbankasJobs },
      cvlt: { jobsFound: cvltJobs.length, jobs: cvltJobs },
      uzt: { jobsFound: uztJobs.length, jobs: uztJobs }
    }
  };

  // Safety: never let a LIMIT'd test run clobber the real production doc.
  const docId = process.env.LIMIT ? 'external-jobs-test' : 'external-jobs';
  await writeDoc('data', docId, output);
  if (docId !== 'external-jobs') {
    console.log(`(LIMIT set - wrote to data/${docId} instead of data/external-jobs)`);
  }

  progress.write({
    status: 'done',
    stage: 'done',
    stageProgress: { current: keywords.length, total: keywords.length },
    totalMatches,
    currentItem: null,
    percent: 100
  });

  console.log('\nSummary:');
  console.log(`CVbankas: ${cvbankasJobs.length}`);
  console.log(`CV.lt: ${cvltJobs.length}`);
  console.log(`Uzimtumo tarnyba: ${uztJobs.length}`);
  console.log(`Total: ${totalMatches}`);
  console.log(`\nData written to Firestore: data/${docId}`);
}

run().catch(err => {
  console.error('Script failed:', err);
  progress.write({
    status: 'error',
    message: err.message,
    stage: 'error',
    stageProgress: { current: 0, total: 0 },
    totalMatches: 0,
    currentItem: null,
    percent: 0
  });
  process.exitCode = 1;
});
