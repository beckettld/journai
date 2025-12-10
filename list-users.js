/**
 * List Users Script
 * Lists all users in Firestore to help find your UID
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
let projectId, privateKey, clientEmail;

try {
  const jsonPath = join(__dirname, 'journai-faff1-firebase-adminsdk-fbsvc-4cc82197a5.json');
  const serviceAccount = JSON.parse(readFileSync(jsonPath, 'utf8'));
  projectId = serviceAccount.project_id;
  privateKey = serviceAccount.private_key;
  clientEmail = serviceAccount.client_email;
} catch (err) {
  projectId = process.env.FIREBASE_PROJECT_ID;
  privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/gm, '\n');
  clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  
  if (!projectId || !privateKey || !clientEmail) {
    console.error('Missing Firebase Admin credentials.');
    process.exit(1);
  }
}

const app = initializeApp({
  credential: cert({ projectId, privateKey, clientEmail }),
});

const db = getFirestore(app);

async function listUsers() {
  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    
    if (snapshot.empty) {
      console.log('No users found.');
      return;
    }
    
    console.log('\n📋 Users in Firestore:\n');
    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`UID: ${doc.id}`);
      console.log(`  Email: ${data.email || 'N/A'}`);
      console.log(`  Name: ${data.displayName || 'N/A'}`);
      console.log('');
    });
  } catch (error) {
    console.error('Error listing users:', error);
    process.exit(1);
  }
}

listUsers();

