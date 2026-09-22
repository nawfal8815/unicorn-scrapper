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

// For read-only endpoints that guests may view without signing in. If a valid,
// allowed bearer token is present, behaves like requireAuth (req.user set). If no
// token is present at all, lets the request through as a guest (req.user stays
// undefined). An invalid/expired/disallowed token is still rejected, same as
// requireAuth - a bad token isn't silently treated as "no token".
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const match = header.match(/^Bearer (.+)$/);

  if (!match) {
    req.isGuest = true;
    return next();
  }

  return requireAuth(req, res, next);
}

module.exports = { requireAuth, optionalAuth, isEmailAllowed, ALLOWED_EMAILS };
