const { getDb } = require('../scraper/firestore');

const COLLECTION = 'applications';

function docId(jobId, personId) {
  return `${jobId}_${personId}`;
}

async function getApplication(jobId, personId) {
  const snap = await getDb().collection(COLLECTION).doc(docId(jobId, personId)).get();
  return snap.exists ? snap.data() : null;
}

async function setApplication(jobId, personId, data) {
  await getDb().collection(COLLECTION).doc(docId(jobId, personId)).set(
    { jobId, personId, updatedAt: new Date().toISOString(), ...data },
    { merge: true }
  );
}

module.exports = { getApplication, setApplication };
