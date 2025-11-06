import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Firebase config (loaded from environment variables)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Optional: Connect to emulators only if explicitly enabled via environment variable
// Set VITE_USE_FIREBASE_EMULATOR=true in .env.local to use emulators
// If not set or false, will use production Firebase
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

if (useEmulator && import.meta.env.DEV) {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  } catch (e: any) {
    // Emulator might already be connected, or not running
    if (e?.code !== 'auth/emulator-config-failed') {
      console.warn('Failed to connect to Auth Emulator. Using production Firebase:', e);
    }
  }
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
  } catch (e: any) {
    // Emulator might already be connected, or not running
    if (e?.message && !e.message.includes('already been called')) {
      console.warn('Failed to connect to Firestore Emulator. Using production Firestore:', e);
    }
  }
}

