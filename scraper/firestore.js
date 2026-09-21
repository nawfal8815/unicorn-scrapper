const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  path.join(__dirname, '..', 'backend', 'firebase-service-account.json');

const STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'baltic-job-radar.firebasestorage.app';

let app;

function getApp() {
  if (!app) {
    app = admin.initializeApp({
      credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
      storageBucket: STORAGE_BUCKET
    });
  }
  return app;
}

function getDb() {
  getApp();
  return admin.firestore();
}

function getBucket() {
  getApp();
  return admin.storage().bucket();
}

async function writeDoc(collection, docId, data) {
  await getDb().collection(collection).doc(docId).set(data);
}

module.exports = { getDb, writeDoc, getBucket };
