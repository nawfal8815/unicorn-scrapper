// Deterministic (not AI) per-job tweaks applied to a CV JSON right before rendering,
// regardless of whether the CV is "tailored" or the shared "standard-qa" one - both
// need this, so it happens at render time rather than at generation time.

const KLAIPEDA_PATTERN = /klaip[eė]da/i;
const RELOCATION_NOTE = ' Based in Klaipeda and open to relocating within Lithuania for the right role.';

function needsRelocationNote(application) {
  const text = [application.jobTitle, application.subtitle].filter(Boolean).join(' ');
  return !KLAIPEDA_PATTERN.test(text);
}

function applyRelocationNote(cv) {
  const clone = JSON.parse(JSON.stringify(cv));
  const bioSection = clone.sections.find(s => s.type === 'paragraph' && /bio|profile/i.test(s.heading));
  if (bioSection && !bioSection.text.includes('relocat')) {
    bioSection.text += RELOCATION_NOTE;
  }
  return clone;
}

// Applies all per-job deterministic adjustments; call this on every CV right before rendering.
function applyJobAdjustments(cv, application) {
  let result = cv;
  if (needsRelocationNote(application)) {
    result = applyRelocationNote(result);
  }
  return result;
}

module.exports = { needsRelocationNote, applyRelocationNote, applyJobAdjustments };
