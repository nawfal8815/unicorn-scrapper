const OPENAI_KEY = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

async function extractRequirementsFromText(jobText) {
  if (!OPENAI_KEY) return null;

  const trimmed = jobText.replace(/\s+/g, ' ').trim().slice(0, 4000);
  if (trimmed.length < 100) return null;

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
          { role: 'user', content: trimmed }
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

async function extractRequirementsFromPage(page, url) {
  if (!OPENAI_KEY) return null;

  const ok = await page
    .goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 })
    .then(() => true)
    .catch(() => false);

  if (!ok) return null;

  const text = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
  return extractRequirementsFromText(text);
}

module.exports = { OPENAI_KEY, extractRequirementsFromText, extractRequirementsFromPage };
