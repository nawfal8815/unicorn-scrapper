const { getDb } = require('../scraper/firestore');

async function getProfile(personId) {
  const snap = await getDb().collection('profiles').doc(personId).get();
  if (!snap.exists) throw new Error(`No profile found for "${personId}" — run cv-builder/seed-profiles.js first.`);
  return snap.data();
}

async function setProfile(personId, cv) {
  await getDb().collection('profiles').doc(personId).set(cv);
}

module.exports = { getProfile, setProfile };
