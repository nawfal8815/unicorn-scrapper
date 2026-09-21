const { matchText } = require('../match');

const BASE_URL = 'https://www.cv.lt/jobs';
const JOB_LINK_RE = /^https:\/\/www\.cv\.lt\/[a-z0-9-]+-\d+$/;
const MAX_PAGES_PER_KEYWORD = 2;

async function scrapeCvLt(page, keywords, { onKeyword } = {}) {
  const seen = new Map();

  for (const keyword of keywords) {
    let newMatches = 0;

    for (let pageNum = 1; pageNum <= MAX_PAGES_PER_KEYWORD; pageNum++) {
      const url =
        `${BASE_URL}?search%5Bkeyword%5D=${encodeURIComponent(keyword)}&page=${pageNum}`;

      const ok = await page
        .goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
        .then(() => true)
        .catch(() => false);

      if (!ok) break;

      const cards = await page
        .$$eval('a', (as, pattern) => {
          const re = new RegExp(pattern);
          return as
            .filter(a => re.test(a.href))
            .map(a => ({ title: a.textContent.replace(/\s+/g, ' ').trim(), href: a.href }));
        }, JOB_LINK_RE.source)
        .catch(() => []);

      if (cards.length === 0) break; // no more pages for this keyword

      for (const card of cards) {
        if (!card.title || seen.has(card.href)) continue;

        // cv.lt's search is loose (matches unrelated titles) - only keep
        // results our own strict keyword match also confirms.
        const matchedKeyword = matchText(card.title);
        if (!matchedKeyword) continue;

        seen.set(card.href, {
          source: 'cvlt',
          title: card.title,
          company: null,
          applyUrl: card.href,
          matchedKeyword,
          requirements: null
        });
        newMatches++;
      }

      await page.waitForTimeout(300 + Math.random() * 300);
    }

    if (onKeyword) onKeyword(keyword, newMatches);
  }

  return Array.from(seen.values());
}

module.exports = { scrapeCvLt };
