const admin = require('firebase-admin');

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS ?? '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

function isEmailAllowed(email) {
  return ALLOWED_EMAILS.includes((email ?? '').toLowerCase());
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const match = header.match(/^Bearer (.+)$/);

  if (!match) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(match[1]);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (!decoded.email_verified || !isEmailAllowed(decoded.email)) {
    return res.status(403).json({ error: 'This account is not authorized for this app' });
  }

  req.user = { uid: decoded.uid, email: decoded.email, name: decoded.name };
  next();
}

module.exports = { requireAuth, isEmailAllowed, ALLOWED_EMAILS };
