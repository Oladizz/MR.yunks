const admin = require('firebase-admin');

try {
  let serviceAccount;
  console.log('FIREBASE_CREDENTIALS:', process.env.FIREBASE_CREDENTIALS ? 'Set' : 'Not Set');
  if (process.env.FIREBASE_CREDENTIALS) {
    serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
  } else {
    serviceAccount = require('../serviceAccountKey.json');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase initialized successfully.');
} catch (error) {
  console.error('Error initializing Firebase:', error.message);
  if (process.env.NODE_ENV === 'production') {
    console.log('Please make sure you have set the FIREBASE_CREDENTIALS environment variable in your production environment.');
  } else {
    console.log('Please make sure you have a valid serviceAccountKey.json file in the root directory for local development.');
  }
  process.exit(1);
}

const db = admin.firestore();

module.exports = { db };
