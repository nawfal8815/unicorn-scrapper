const { OPENAI_KEY } = require('../scraper/ai');

function flattenSkills(cv) {
  const items = [];
  for (const section of cv.sections) {
    if (section.type === 'skillsGrid') {
      for (const g of section.groups) items.push(...g.items);
    }
    if (section.type === 'twoColumnBulletList') {
      for (const col of section.columns) items.push(...col.items);
    }
  }
  return items;
}

async function pickMissingSkills(cv, job) {
  const existing = flattenSkills(cv);
  const requirements = job.requirements || [];

  if (!OPENAI_KEY || requirements.length === 0) return [];

  const prompt =
    `Candidate's current skills/experience keywords:\n${existing.join(', ')}\n\n` +
    `Job requirements for "${job.title}" at ${job.company}:\n${requirements.map(r => `- ${r}`).join('\n')}\n\n` +
    'Which of these requirements name a specific tool/framework/technology/skill that is NOT already ' +
    'covered (directly or as a close equivalent) by the candidate\'s current skills? ' +
    'Respond with ONLY a JSON array of short skill/tool names to add (max 5 items, each 1-4 words, ' +
    'no explanations). If everything is already covered, respond with [].';

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
              'You compare a candidate\'s skill list against a job\'s requirements and identify only the ' +
              'genuinely missing named tools/technologies/frameworks. Respond with ONLY a JSON array, no prose.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 200
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) return [];

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return [];

    const cleaned = content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```$/, '')
      .trim();

    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed.slice(0, 5).filter(s => typeof s === 'string' && s.trim()) : [];
  } catch {
    return [];
  }
}

function injectSkills(cv, addedSkills) {
  if (addedSkills.length === 0) return cv;

  const skillsSection = cv.sections.find(s => s.type === 'skillsGrid');
  if (skillsSection) {
    skillsSection.groups.push({ label: 'Additional', items: addedSkills });
    return cv;
  }

  const twoCol = cv.sections.find(s => s.type === 'twoColumnBulletList');
  if (twoCol) {
    twoCol.columns[0].items.push(...addedSkills);
    return cv;
  }

  return cv;
}

async function tailorCvForJob(baseCv, job) {
  const cv = JSON.parse(JSON.stringify(baseCv));
  const addedSkills = await pickMissingSkills(cv, job);
  const tailored = injectSkills(cv, addedSkills);
  return { cv: tailored, addedSkills };
}

module.exports = { tailorCvForJob, flattenSkills };
