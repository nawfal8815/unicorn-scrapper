const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  path.join(__dirname, '..', 'backend', 'firebase-service-account.json');

let app;

function getApp() {
  if (!app) {
    app = admin.initializeApp({
      credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH))
    });
  }
  return app;
}

function getDb() {
  getApp();
  return admin.firestore();
}

async function writeDoc(collection, docId, data) {
  await getDb().collection(collection).doc(docId).set(data);
}

module.exports = { getDb, writeDoc };
