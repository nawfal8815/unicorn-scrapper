const { matchText } = require('../match');

const BASE_URL = 'https://www.cvbankas.lt/';

async function scrapeCvbankas(page, keywords, { onKeyword } = {}) {
  const seen = new Map();

  for (const keyword of keywords) {
    const url = `${BASE_URL}?keyw=${encodeURIComponent(keyword)}`;

    const ok = await page
      .goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    if (!ok) {
      if (onKeyword) onKeyword(keyword, 0);
      continue;
    }

    const cards = await page
      .$$eval('a.list_a', as =>
        as.map(a => {
          const h3 = a.querySelector('h3.list_h3');
          const companyEl = a.querySelector('.heading_secondary');
          return {
            title: h3 ? h3.textContent.replace(/\s+/g, ' ').trim() : '',
            company: companyEl ? companyEl.textContent.replace(/\s+/g, ' ').trim() : null,
            href: a.href
          };
        })
      )
      .catch(() => []);

    let newMatches = 0;

    for (const card of cards) {
      if (!card.title || !card.href || seen.has(card.href)) continue;

      // CVbankas' search can loosely match on individual words within a
      // multi-word query (e.g. "IT Intern" surfacing "Export Manager") - only
      // keep results our own strict keyword match also confirms.
      const matchedKeyword = matchText(card.title);
      if (!matchedKeyword) continue;

      seen.set(card.href, {
        source: 'cvbankas',
        title: card.title,
        company: card.company,
        applyUrl: card.href,
        matchedKeyword,
        requirements: null
      });
      newMatches++;
    }

    if (onKeyword) onKeyword(keyword, newMatches);

    await page.waitForTimeout(400 + Math.random() * 400);
  }

  return Array.from(seen.values());
}

module.exports = { scrapeCvbankas };
