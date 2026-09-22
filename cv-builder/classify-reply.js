const { OPENAI_KEY } = require('../scraper/ai');

const VALID = new Set(['confirmation', 'rejection', 'needs-attention']);

// Classifies an inbound reply to a job application email.
// - confirmation: plain auto-ack ("we received your application"), no action needed
// - rejection: a "we're not moving forward" style reply - worth a polite feedback-seeking reply
// - needs-attention: anything else (interview request, question, ambiguous) - a human should look
async function classifyReply(replyText) {
  if (!OPENAI_KEY || !replyText?.trim()) return { type: 'needs-attention', summary: null };

  const trimmed = replyText.replace(/\s+/g, ' ').trim().slice(0, 3000);

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
              'Classify a job-application reply email into exactly one category: "confirmation" (a plain ' +
              'automatic acknowledgement that the application was received, nothing else), "rejection" (the ' +
              'company says they are not moving forward), or "needs-attention" (anything else - interview ' +
              'requests, questions, ambiguous replies, anything a human should read). Respond with ONLY a ' +
              'JSON object: {"type": "...", "summary": "<one short sentence summarizing the reply>"}. No prose, ' +
              'no markdown fences.'
          },
          { role: 'user', content: trimmed }
        ],
        temperature: 0,
        max_tokens: 150
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) return { type: 'needs-attention', summary: null };

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return { type: 'needs-attention', summary: null };

    const cleaned = content.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      type: VALID.has(parsed.type) ? parsed.type : 'needs-attention',
      summary: typeof parsed.summary === 'string' ? parsed.summary : null
    };
  } catch {
    return { type: 'needs-attention', summary: null };
  }
}

module.exports = { classifyReply };
