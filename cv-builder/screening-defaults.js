// Fixed default answers for common application screening questions, used by
// form-filling automation (career-page forms, CVbankas/CV.lt) when a field asks for
// something beyond name/email/phone/CV. Same for both people right now (confirmed by
// the user - "we" answers) but structured per-person in case that ever changes.

const SHARED = {
  workAuthorization: 'Holds a Lithuanian Temporary Residence Permit (TRP) - authorized to work in Lithuania, no sponsorship needed.',
  expectedSalaryNet: 1500, // EUR/month, net (after taxes) - minimum acceptable
  expectedSalaryText: 'Minimum €1,500/month net (after taxes), negotiable depending on the role.',
  noticePeriod: '1 to 3 months depending on current employer, but immediately available if required.',
  relocation: 'Based in Klaipeda, open to relocating anywhere within Lithuania for the right role.'
};

const DEFAULTS = {
  naoufal: { ...SHARED },
  seif: { ...SHARED }
};

function getScreeningDefaults(personId) {
  return DEFAULTS[personId] ?? SHARED;
}

module.exports = { getScreeningDefaults };
