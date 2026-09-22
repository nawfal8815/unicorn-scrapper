// Tier 1 (best) = explicitly entry-level / no experience required, or nothing stated.
// Tier 2 = under 2 years required. Tier 3 = 2+ years required.
// Purely a display/filter concern - every job still gets applied to regardless of tier.

const NO_EXPERIENCE_PATTERN =
  /\bno\s+(?:prior\s+)?experience\s+(?:is\s+)?(?:required|needed|necessary)\b|\bentry[\s-]level\b|\bno\s+experience\s+necessary\b/i;

const YEARS_PATTERN = /(\d+)\s*\+?\s*(?:-\s*\d+\s*)?\s*(?:years?|yrs?)\b(?:\s*of)?\s*(?:experience|exp\.?)?/i;

// Title-only seniority words: a stated years count always wins, but a bare "Senior"/
// "Junior" title with no explicit years should still tier correctly.
const SENIOR_TITLE_PATTERN = /\b(senior|sr\.?|lead|principal|staff|head\s+of)\b/i;
const JUNIOR_TITLE_PATTERN = /\b(junior|jr\.?|entry|intern|trainee|graduate)\b/i;

export const TIER_META = {
  1: { label: 'Entry level', tone: 'good' },
  2: { label: 'Under 2yrs', tone: 'warn' },
  3: { label: '2+ years', tone: 'bad' }
};

export function getExperienceTier(job) {
  const text = [job.title, job.subtitle, ...(job.requirements || [])].filter(Boolean).join(' \n ');

  if (NO_EXPERIENCE_PATTERN.test(text)) return 1;

  const match = text.match(YEARS_PATTERN);
  if (match) {
    const years = Number(match[1]);
    return years >= 2 ? 3 : 2;
  }

  const titleAndSubtitle = [job.title, job.subtitle].filter(Boolean).join(' ');
  if (SENIOR_TITLE_PATTERN.test(titleAndSubtitle)) return 3;
  if (JUNIOR_TITLE_PATTERN.test(titleAndSubtitle)) return 1;

  return 1; // no experience requirement stated at all - treat as accessible
}
