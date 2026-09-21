const MAP = new Map(
  (process.env.PERSON_EMAIL_MAP ?? '')
    .split(',')
    .map(pair => pair.trim().split(':'))
    .filter(([email, id]) => email && id)
    .map(([email, id]) => [email.trim().toLowerCase(), id.trim()])
);

function personIdForEmail(email) {
  return MAP.get((email ?? '').toLowerCase()) ?? null;
}

module.exports = { personIdForEmail };
