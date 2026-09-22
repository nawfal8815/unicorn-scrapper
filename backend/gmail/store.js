const admin = require('firebase-admin');

const COLLECTION = 'gmail-connections';

function getDb() {
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
