const { OPENAI_KEY } = require('../scraper/ai');

function flattenRealSkills(profile) {
  const items = [];
  for (const section of profile.sections) {
    if (section.type === 'skillsGrid') {
      for (const g of section.groups) {
        if (g.label !== 'Additional') items.push(...g.items); // "Additional" = flagged-missing, not real
      }
    }
    if (section.type === 'twoColumnBulletList') {
      for (const col of section.columns) items.push(...col.items);
    }
  }
  return items;
}

async function generateCoverLetter(profile, job) {
  if (!OPENAI_KEY) return null;

  const realSkills = flattenRealSkills(profile);

  const prompt =
    `Candidate name: ${profile.name}\n` +
    `Candidate bio: ${profile.sections.find(s => s.heading === 'BIO' || s.heading === 'Profile')?.text ?? ''}\n` +
    `Candidate's ACTUAL skills/experience (only claim things from this list as things they've done):\n` +
    `${realSkills.join(', ')}\n\n` +
    `Job: ${job.title} at ${job.company}\n` +
    `Job requirements:\n${(job.requirements || []).map(r => `- ${r}`).join('\n')}\n\n` +
    'Write a short, genuine cover letter email body (not a full letter with address blocks) for this ' +
    'candidate applying to this role. 3 short paragraphs max: (1) why this role/company specifically, ' +
    '(2) 1-2 concrete things from the candidate\'s ACTUAL skills list that map to the requirements - ' +
    'never claim experience with a specific tool/technology unless it appears in the actual skills list above, ' +
    'even if the job requires it; if a requirement isn\'t covered, either skip it or honestly frame it as ' +
    'something the candidate is quick to pick up, (3) a brief, confident close. No generic filler phrases ' +
    '("I am writing to express my interest"), no markdown, plain text only, sign off with just the candidate\'s first name.';

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
              'You write concise, specific, non-generic cover letter emails for software/QA job applications. ' +
              'Strict rule: never state or imply the candidate has used, worked with, or has experience with a ' +
              'named tool/technology/framework that is not verbatim in the candidate\'s actual skills list, even ' +
              'as an aside ("aligns with", "similar to", "which involved"). If in doubt, omit that requirement ' +
              'entirely rather than risk implying false experience.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.6,
        max_tokens: 400
      }),
      signal: AbortSignal.timeout(20000)
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

module.exports = { generateCoverLetter };
