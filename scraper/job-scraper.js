const { chromium } = require('playwright');
const { PHRASES, SHORT_CODES } = require('./keywords');
const { createProgressWriter } = require('./progress');
const { getDb, writeDoc } = require('./firestore');

const progress = createProgressWriter('jobs');

const CONCURRENCY = Number(process.env.CONCURRENCY || 4);
const COMPANY_TIMEOUT_MS = Number(process.env.COMPANY_TIMEOUT_MS || 60000);
const NAV_TIMEOUT_MS = Number(process.env.NAV_TIMEOUT_MS || 20000);
const MAX_JOBS_PER_COMPANY = 8;
const OPENAI_KEY = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

const CAREER_LINK_PATTERNS = [
  { regex: /career/i, score: 3 },
  { regex: /\bjobs?\b/i, score: 2 },
  { regex: /vacan|join[\s-]?us|karjer|darbo\s*skelbim/i, score: 1 }
];

const FALLBACK_PATHS = ['/careers', '/career', '/jobs', '/en/careers', '/join-us'];

async function loadCandidateCompanies() {
  const snap = await getDb().collection('data').doc('scraped').get();

  if (!snap.exists) {
    throw new Error('No scraped data found in Firestore (data/scraped). Run "npm run scrape" first.');
  }

  const raw = snap.data();
  const buckets = ['perfectMatches', 'lessThan1000', 'goodStartups'];
  const companies = [];
  const noWebsite = [];

  for (const bucket of buckets) {
    for (const company of raw[bucket] ?? []) {
      if (company.website) {
        companies.push({ name: company.name, website: company.website, bucket });
      } else {
        noWebsite.push({ name: company.name, bucket });
      }
    }
  }

  return { companies, noWebsite };
}

async function withTimeout(promise, ms, fallback) {
  let timer;
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  const result = await Promise.race([promise, timeout]);
  clearTimeout(timer);
  return result;
}

async function findCareersLink(page, baseUrl) {
  const links = await page
    .$$eval('a', as =>
      as.map(a => ({ text: (a.textContent || '').trim(), href: a.getAttribute('href') || '' }))
    )
    .catch(() => []);

  let best = null;

  for (const { text, href } of links) {
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) {
      continue;
    }

    const haystack = `${text} ${href}`;
    let score = 0;

    for (const { regex, score: s } of CAREER_LINK_PATTERNS) {
      if (regex.test(haystack)) {
        score = Math.max(score, s);
      }
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { href, score };
    }
  }

  if (!best) return null;

  try {
    return new URL(best.href, baseUrl).toString();
  } catch {
    return null;
  }
}

function matchKeywords(anchors) {
  const results = [];

  for (const { text, href } of anchors) {
    if (!text || text.length < 3 || text.length > 150) continue;

    const lower = text.toLowerCase();
    let keyword = PHRASES.find(p => lower.includes(p.toLowerCase()));

    if (!keyword) {
      keyword = SHORT_CODES.find(code => new RegExp(`\\b${code}\\b`, 'i').test(text));
    }

    if (keyword) {
      results.push({ text, href, keyword });
    }
  }

  return results;
}

async function collectAnchors(page) {
  const anchors = [];
  const frames = page.frames();

  for (const frame of frames) {
    const found = await frame
      .$$eval('a', as =>
        as.map(a => ({
          text: (a.textContent || '').replace(/\s+/g, ' ').trim(),
          href: a.getAttribute('href') || ''
        }))
      )
      .catch(() => []);

    anchors.push(...found);
  }

  return anchors;
}

async function callOpenAI(jobText) {
  if (!OPENAI_KEY) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Extract the requirements/qualifications from this job posting text as a ' +
              'short JSON array of concise bullet strings (max 6 items, each under 15 words). ' +
              'Respond with ONLY a JSON array, no prose, no markdown fences. ' +
              'If the text is not a real job posting or has no clear requirements, respond with [].'
          },
          { role: 'user', content: jobText }
        ],
        temperature: 0.2,
        max_tokens: 400
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) return null;

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const cleaned = content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```$/, '')
      .trim();

    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) && parsed.length ? parsed.slice(0, 6) : null;
  } catch {
    return null;
  }
}

async function extractRequirements(page, url) {
  if (!OPENAI_KEY) return null;

  const ok = await page
    .goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 })
    .then(() => true)
    .catch(() => false);

  if (!ok) return null;

  const text = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
  const trimmed = text.replace(/\s+/g, ' ').trim().slice(0, 4000);

  if (trimmed.length < 100) return null;

  return callOpenAI(trimmed);
}

async function goWithRetry(page, url, { timeout = NAV_TIMEOUT_MS, retries = 1 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    } catch (err) {
      if (attempt === retries) return null;
      await page.waitForTimeout(500);
    }
  }
  return null;
}

async function processCompany(page, company) {
  const jobs = [];

  const homeResponse = await goWithRetry(page, company.website, { retries: 1 });

  if (!homeResponse) {
    return { careersUrl: null, jobs, websiteReachable: false };
  }

  let careersUrl = await findCareersLink(page, page.url());

  if (careersUrl) {
    const ok = await goWithRetry(page, careersUrl, { retries: 1 });
    if (!ok) careersUrl = null;
  }

  if (!careersUrl) {
    for (const p of FALLBACK_PATHS) {
      let candidate;
      try {
        candidate = new URL(p, company.website).toString();
      } catch {
        continue;
      }

      const response = await goWithRetry(page, candidate, { timeout: 10000, retries: 0 });

      if (response && response.ok()) {
        careersUrl = candidate;
        break;
      }
    }
  }

  if (!careersUrl) {
    return { careersUrl: null, jobs, websiteReachable: true };
  }

  await page.waitForTimeout(600);

  const anchors = await collectAnchors(page);
  const matched = matchKeywords(anchors);
  const seen = new Set();

  for (const m of matched) {
    if (jobs.length >= MAX_JOBS_PER_COMPANY) continue;

    const href = m.href.trim();
    if (
      !href ||
      href === '#' ||
      href.startsWith('javascript:') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:')
    ) {
      continue;
    }

    let absolute;
    try {
      absolute = new URL(href, careersUrl).toString();
    } catch {
      continue;
    }

    if (seen.has(absolute)) continue;
    seen.add(absolute);

    // Career cards often wrap title + level + team + location in one anchor,
    // separated by " · " - keep the first segment as the clean title and the
    // rest as a subtitle for extra context.
    const parts = m.text.split(' · ').map(s => s.trim()).filter(Boolean);
    const title = (parts[0] || m.text).slice(0, 200);
    const subtitle = parts.length > 1 ? parts.slice(1).join(' · ').slice(0, 200) : null;

    jobs.push({
      company: company.name,
      companyWebsite: company.website,
      careersUrl,
      title,
      subtitle,
      applyUrl: absolute,
      matchedKeyword: m.keyword,
      requirements: null
    });
  }

  for (const job of jobs) {
    job.requirements = await extractRequirements(page, job.applyUrl).catch(() => null);
  }

  return { careersUrl, jobs, websiteReachable: true };
}

async function run() {
  let { companies, noWebsite } = await loadCandidateCompanies();

  if (process.env.LIMIT) {
    companies = companies.slice(0, Number(process.env.LIMIT));
  }

  console.log(`Loaded ${companies.length} companies with a website to scan.`);
  if (noWebsite.length) {
    console.log(`${noWebsite.length} qualifying companies have no captured website - skipped.`);
  }
  console.log(
    OPENAI_KEY
      ? 'OpenAI key detected - requirements extraction enabled.'
      : 'No OpenAI key found - skipping requirements extraction.'
  );

  progress.write({
    status: 'running',
    totalCompanies: companies.length,
    processed: 0,
    careersPagesFound: 0,
    jobsFound: 0,
    currentCompany: null,
    percent: 0
  });

  const browser = await chromium.launch({
    headless: process.env.HEADFUL !== '1'
  });

  let idx = 0;
  function next() {
    return idx < companies.length ? companies[idx++] : null;
  }

  const allJobs = [];
  const companyReports = [];
  let careersFound = 0;
  let processed = 0;

  async function worker(workerId) {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);

    await page.route('**/*', route => {
      const type = route.request().resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    let company;
    while ((company = next())) {
      try {
        const result = await withTimeout(processCompany(page, company), COMPANY_TIMEOUT_MS, {
          careersUrl: null,
          jobs: [],
          websiteReachable: null,
          timedOut: true
        });

        if (result.timedOut) {
          console.log(`[${company.name}] timed out after ${COMPANY_TIMEOUT_MS}ms, skipping.`);
          await page.goto('about:blank').catch(() => {});
        }

        if (result.careersUrl) careersFound++;
        if (result.jobs.length) {
          allJobs.push(...result.jobs);
          console.log(`[${company.name}] ${result.jobs.length} matching job(s) found.`);
        }

        let status;
        if (result.timedOut) status = 'timed-out';
        else if (result.websiteReachable === false) status = 'website-unreachable';
        else if (!result.careersUrl) status = 'no-careers-page';
        else if (result.jobs.length === 0) status = 'careers-page-no-match';
        else status = 'matched';

        companyReports.push({
          name: company.name,
          website: company.website,
          careersUrl: result.careersUrl,
          jobsFound: result.jobs.length,
          status
        });

        progress.pushRecent({
          name: company.name,
          careersFound: Boolean(result.careersUrl),
          jobsFound: result.jobs.length
        });
      } catch (err) {
        console.log(`[worker ${workerId}] error on "${company.name}": ${err.message}`);
        await page.goto('about:blank').catch(() => {});
        companyReports.push({
          name: company.name,
          website: company.website,
          careersUrl: null,
          jobsFound: 0,
          status: 'error',
          error: err.message
        });
        progress.pushRecent({ name: company.name, careersFound: false, jobsFound: 0 });
      }

      processed++;

      progress.write({
        status: 'running',
        totalCompanies: companies.length,
        processed,
        careersPagesFound: careersFound,
        jobsFound: allJobs.length,
        currentCompany: company.name,
        percent: Math.round((processed / companies.length) * 100)
      });

      if (processed % 20 === 0) {
        console.log(
          `Processed ${processed}/${companies.length} companies - ` +
          `${careersFound} careers pages found, ${allJobs.length} jobs matched so far.`
        );
      }
    }

    await context.close();
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, companies.length) }, (_, i) => worker(i))
  );

  await browser.close();

  for (const company of noWebsite) {
    companyReports.push({
      name: company.name,
      website: null,
      careersUrl: null,
      jobsFound: 0,
      status: 'no-website'
    });
  }

  const output = {
    scrapedAt: new Date().toISOString(),
    companiesScanned: companies.length,
    companiesQualifying: companies.length + noWebsite.length,
    careersPagesFound: careersFound,
    jobsFound: allJobs.length,
    aiRequirementsEnabled: Boolean(OPENAI_KEY),
    jobs: allJobs,
    companies: companyReports
  };

  progress.write({
    status: 'done',
    totalCompanies: companies.length,
    processed: companies.length,
    careersPagesFound: careersFound,
    jobsFound: allJobs.length,
    currentCompany: null,
    percent: 100
  });

  await writeDoc('data', 'jobs', output);

  console.log('\nSummary:');
  console.log(`Companies scanned: ${companies.length}`);
  console.log(`Careers pages found: ${careersFound}`);
  console.log(`Jobs matched: ${allJobs.length}`);
  console.log('\nData written to Firestore: data/jobs');
}

run().catch(err => {
  console.error('Script failed:', err);
  progress.write({
    status: 'error',
    message: err.message,
    totalCompanies: 0,
    processed: 0,
    careersPagesFound: 0,
    jobsFound: 0,
    currentCompany: null,
    percent: 0
  });
  process.exitCode = 1;
});
