import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';
import { 
  FIREBASE_PROJECT_ID, 
  FIREBASE_PRIVATE_KEY, 
  FIREBASE_CLIENT_EMAIL 
} from '$env/static/private';

let adminApp: App | null = null;
let adminDb: Firestore | null = null;

export function getAdminApp(): App {
  if (adminApp) {
    return adminApp;
  }

  // Check if app already exists
  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  // Try to load from environment variables first (SvelteKit way)
  let projectId = FIREBASE_PROJECT_ID;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY
          ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/gm, "\n")
          : undefined;
  let clientEmail = FIREBASE_CLIENT_EMAIL;

  // If env vars not set, try to load from JSON file
  if (!projectId || !privateKey || !clientEmail) {
    try {
      const jsonPath = join(process.cwd(), 'journai-faff1-firebase-adminsdk-fbsvc-4cc82197a5.json');
      const serviceAccount = JSON.parse(readFileSync(jsonPath, 'utf8'));
      
      projectId = serviceAccount.project_id;
      privateKey = serviceAccount.private_key;
      clientEmail = serviceAccount.client_email;
      
      console.log('[Firebase Admin] Loaded credentials from JSON file');
    } catch (jsonErr: any) {
      // JSON file not found or invalid, continue to check env vars
      console.warn('[Firebase Admin] Could not load from JSON file:', jsonErr.message);
    }
  }

  if (!projectId || !privateKey || !clientEmail) {
    throw new Error(
      'Missing Firebase Admin credentials. Please set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL in your environment variables, or place the service account JSON file in the project root.'
    );
  }

  adminApp = initializeApp({
    credential: cert({
      projectId,
      privateKey,
      clientEmail,
    }),
  });

  return adminApp;
}

export function getAdminDb(): Firestore {
  if (adminDb) {
    return adminDb;
  }

  const app = getAdminApp();
  adminDb = getFirestore(app);
  return adminDb;
}

