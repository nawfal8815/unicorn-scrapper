const path = require('path');
const admin = require('firebase-admin');

const COLLECTION = 'gmail-connections';

// Self-initializes if nothing else in this process already has (this module gets
// required both from the backend server, which initializes its own admin app, and
// from standalone cv-builder scripts, which don't touch this specific `firebase-admin`
// module instance - backend/ has its own node_modules, so it's a separate singleton).
function getDb() {
  if (!admin.apps.length) {
    // Anchored to this file's location, not cwd: FIREBASE_SERVICE_ACCOUNT_PATH in
    // backend/.env is a relative path meant for when the backend server's cwd is
    // backend/, which isn't true when this module is required from root-run scripts.
    const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
    admin.initializeApp({ credential: admin.credential.cert(require(serviceAccountPath)) });
  }
  return admin.firestore();
}

async function getConnection(personId) {
  const snap = await getDb().collection(COLLECTION).doc(personId).get();
  return snap.exists ? snap.data() : null;
}

async function setConnection(personId, data) {
  await getDb().collection(COLLECTION).doc(personId).set(
    { personId, updatedAt: new Date().toISOString(), ...data },
    { merge: true }
  );
}

async function removeConnection(personId) {
  await getDb().collection(COLLECTION).doc(personId).delete();
}

module.exports = { getConnection, setConnection, removeConnection };
