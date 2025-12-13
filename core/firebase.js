const admin = require('firebase-admin');

try {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase initialized successfully.');
} catch (error) {
  console.error('Error initializing Firebase:', error.message);
  console.log('Please make sure you have a valid serviceAccountKey.json file in the root directory.');
  process.exit(1);
}

const db = admin.firestore();

module.exports = { db };
