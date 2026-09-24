const { matchText } = require('../match');
const { extractRequirementsFromText } = require('../ai');

const BASE_URL = 'https://uzt.lt/app/laisvos-darbo-vietos';
const TITLE_SELECTOR = 'div[class*="font-semibold"][class*="text-lg"]';
const MAX_PAGES = process.env.LIMIT ? 3 : 90; // ~3990 listings / 50 per page
const MAX_MATCHES = process.env.LIMIT ? 5 : 150; // safety cap on detail-page clicks

async function dismissCookieBanner(page) {
  // The banner's own text is Lithuanian ("Leisti visus slapukus" = "Allow all cookies"),
  // not English - fixed once already, but a second bug remained: this used to do a fixed
  // 1s sleep then an immediate page.$() check, so on a slow-loading run the banner simply
  // hadn't rendered yet, the check found nothing, and the banner stayed up - silently
  // blocking every later click (pagination "next" included) for the rest of the run, which
  // is exactly why runs kept finding page 1 and then stopping. waitForSelector actually
  // waits for it to appear instead of guessing at a fixed delay, and waiting for the
  // button to detach after clicking confirms the banner is genuinely gone before continuing.
  const btn = await page
    .waitForSelector('button:has-text("Leisti visus slapukus")', { timeout: 8000 })
    .catch(() => null);
  if (!btn) return;
  await btn.click().catch(() => {});
  await btn.waitForElementState('hidden', { timeout: 5000 }).catch(() => {});
}

async function setPageSizeTo50(page) {
  const select = await page.$('mat-paginator mat-select');
  if (!select) return;
  await select.click().catch(() => {});
  await page.waitForTimeout(300);
  const option = await page.$('mat-option:has-text("50")');
  if (option) {
    await option.click().catch(() => {});
    await page.waitForTimeout(500);
  }
}

// uzt.lt's own keyword search is unreliable (exact phrases return zero
// results, generic terms return unrelated listings), so instead of searching
// per-keyword like the other sites, this crawls every listing directly and
// applies our own keyword match against each title.
async function scrapeUzt(page, { onProgress } = {}) {
  const results = [];

  const ok = await page
    .goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
    .then(() => true)
    .catch(() => false);

  if (!ok) return results;

  await page.waitForTimeout(1000);
  await dismissCookieBanner(page);
  await page.waitForTimeout(300);
  await setPageSizeTo50(page);
  await page.waitForTimeout(500);

  let pageIndex = 1;

  while (pageIndex <= MAX_PAGES && results.length < MAX_MATCHES) {
    await page.waitForSelector(TITLE_SELECTOR, { timeout: 10000 }).catch(() => {});

    const titles = await page
      .$$eval(TITLE_SELECTOR, els => els.map(el => el.textContent.replace(/\s+/g, ' ').trim()))
      .catch(() => []);

    const matchedIndexes = [];
    titles.forEach((t, i) => {
      if (matchText(t)) matchedIndexes.push(i);
    });

    for (const idx of matchedIndexes) {
      if (results.length >= MAX_MATCHES) break;

      // Re-query handles each time - the DOM is recreated after goBack().
      const handles = await page.$$(TITLE_SELECTOR);
      const handle = handles[idx];
      if (!handle) continue;

      const title = titles[idx];
      const keyword = matchText(title);

      const clicked = await handle.click().then(() => true).catch(() => false);
      if (!clicked) continue;

      const navigated = await page
        .waitForURL(/\/skelbimas\//, { timeout: 8000 })
        .then(() => true)
        .catch(() => false);

      if (navigated) {
        const applyUrl = page.url();

        if (!results.some(r => r.applyUrl === applyUrl)) {
          const text = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
          const requirements = await extractRequirementsFromText(text).catch(() => null);

          results.push({
            source: 'uzt',
            title,
            company: null,
            applyUrl,
            matchedKeyword: keyword,
            requirements
          });
        }

        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
        await page.waitForSelector(TITLE_SELECTOR, { timeout: 10000 }).catch(() => {});
      }
    }

    if (onProgress) onProgress(pageIndex, results.length);

    const nextBtn = await page.$('button.mat-mdc-paginator-navigation-next');
    if (!nextBtn) break;

    const disabled = await nextBtn.getAttribute('disabled').catch(() => 'true');
    if (disabled !== null) break;

    const advanced = await nextBtn.click().then(() => true).catch(() => false);
    if (!advanced) break;

    await page.waitForTimeout(700);
    pageIndex++;
  }

  return results;
}

module.exports = { scrapeUzt };
