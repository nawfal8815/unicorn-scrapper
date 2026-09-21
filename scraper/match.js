const { PHRASES, SHORT_CODES } = require('./keywords');

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Word-boundary regex per phrase - a plain substring check would let e.g.
// "audit assistant" false-match the phrase "IT Assistant" (the raw text
// "aud" + "it assistant" contains it), so every phrase is anchored to real
// word boundaries instead.
const PHRASE_PATTERNS = PHRASES.map(p => ({
  phrase: p,
  regex: new RegExp(`\\b${escapeRegExp(p)}\\b`, 'i')
}));

const CODE_PATTERNS = SHORT_CODES.map(c => ({
  code: c,
  regex: new RegExp(`\\b${c}\\b`, 'i')
}));

// Returns the first matching keyword phrase/code found in `text`, or null.
function matchText(text) {
  if (!text || text.length < 3 || text.length > 150) return null;

  const phrase = PHRASE_PATTERNS.find(({ regex }) => regex.test(text));
  if (phrase) return phrase.phrase;

  const code = CODE_PATTERNS.find(({ regex }) => regex.test(text));
  return code ? code.code : null;
}

// Matches an array of {text, href} anchors, returning only the matched ones
// annotated with their matched keyword.
function matchAnchors(anchors) {
  const results = [];

  for (const { text, href } of anchors) {
    const keyword = matchText(text);
    if (keyword) results.push({ text, href, keyword });
  }

  return results;
}

module.exports = { matchText, matchAnchors };
