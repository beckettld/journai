import { getAdminDb } from '$lib/firebase/admin';
import type { Message } from '$lib/stores/sessionStore';
import { Timestamp } from 'firebase-admin/firestore';

export type VentSession = {
  id: string;
  startTime: number; // Unix timestamp in milliseconds
  durationMinutes: number;
  messages: Message[];
  completedAt?: Timestamp;
  createdAt: Timestamp;
  lastUpdated: Timestamp;
};

export type UserDocument = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  admin?: boolean;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
};

export type WeekDocument = {
  weekId: string;
  ventEntryCount: number;
  lastVentSessionAt?: Timestamp;
  createdAt: Timestamp;
  lastUpdated: Timestamp;
};

/**
 * Save a vent session to the ventSessions collection (server-side)
 * Path: /users/{uid}/weeks/{weekId}/ventSessions/{sessionId}
 */
export async function saveVentSessionServer(
  uid: string,
  weekId: string,
  sessionId: string,
  data: {
    startTime: number;
    durationMinutes: number;
    messages: Message[];
  }
): Promise<void> {
  const db = getAdminDb();
  
  // Ensure week document exists first
  const weekRef = db.doc(`users/${uid}/weeks/${weekId}`);
  const weekDoc = await weekRef.get();
  
  const now = Timestamp.now();
  
  if (!weekDoc.exists) {
    await weekRef.set({
      weekId,
      ventEntryCount: 0,
      createdAt: now,
      lastUpdated: now,
    });
  }

  const sessionRef = db.doc(`users/${uid}/weeks/${weekId}/ventSessions/${sessionId}`);
  const sessionDoc = await sessionRef.get();
  const isNewSession = !sessionDoc.exists;

  // Save the vent session
  await sessionRef.set({
    startTime: data.startTime,
    durationMinutes: data.durationMinutes,
    messages: data.messages,
    completedAt: now,
    createdAt: isNewSession ? now : sessionDoc.data()?.createdAt || now,
    lastUpdated: now,
  });

  // If it's a new session, increment the vent count and update lastVentSessionAt
  if (isNewSession) {
    const currentCount = (weekDoc.data() as WeekDocument)?.ventEntryCount || 0;
    await weekRef.set(
      {
        ventEntryCount: currentCount + 1,
        lastVentSessionAt: now,
        lastUpdated: now,
      },
      { merge: true }
    );
  }
}

/**
 * Save a mentor session to the entries collection (server-side)
 * Path: /users/{uid}/weeks/{weekId}/entries/mentor
 */
export async function saveMentorSessionServer(
  uid: string,
  weekId: string,
  data: {
    messages: Message[];
    summary?: string;
    timestamp?: number;
  }
) {
  const db = getAdminDb();

  // Ensure the week document exists
  const weekRef = db.doc(`users/${uid}/weeks/${weekId}`);
  const weekDoc = await weekRef.get();
  const now = Timestamp.now();

  if (!weekDoc.exists) {
    await weekRef.set({
      weekId,
      ventEntryCount: 0,
      createdAt: now,
      lastUpdated: now,
    });
  }

  const entryRef = db.doc(`users/${uid}/weeks/${weekId}/entries/mentor`);
  await entryRef.set({
    uid,
    weekId,
    mode: 'mentor',
    messages: data.messages,
    summary: data.summary ?? null,
    timestamp: data.timestamp ?? Date.now(),
    lastUpdated: now,
  });
}

/**
 * Check if a user is an admin
 * Path: /users/{uid}
 */
export async function isUserAdmin(uid: string): Promise<boolean> {
  try {
    const db = getAdminDb();
    const userRef = db.doc(`users/${uid}`);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.log(`[isUserAdmin] User document does not exist for uid: ${uid}`);
      return false;
    }
    
    const userData = userDoc.data();
    console.log(`[isUserAdmin] User ${uid} - Full document data:`, JSON.stringify(userData, null, 2));
    console.log(`[isUserAdmin] User ${uid} - admin field value:`, userData?.admin, `type:`, typeof userData?.admin);
    
    // Check for boolean true, or string "true"
    const adminValue = userData?.admin;
    const isAdmin = adminValue === true || adminValue === 'true' || adminValue === 1;
    
    console.log(`[isUserAdmin] User ${uid} - Final isAdmin result: ${isAdmin}`);
    return isAdmin;
  } catch (err: any) {
    console.error(`[isUserAdmin] Error checking admin status for ${uid}:`, err);
    console.error(`[isUserAdmin] Error stack:`, err.stack);
    return false;
  }
}

/**
 * Get the vent count for a specific week (server-side)
 * Path: /users/{uid}/weeks/{weekId}
 */
export async function getWeekVentCountServer(uid: string, weekId: string): Promise<number> {
  try {
    const db = getAdminDb();
    const weekRef = db.doc(`users/${uid}/weeks/${weekId}`);
    const weekDoc = await weekRef.get();
    
    if (!weekDoc.exists) {
      console.log(`[getWeekVentCountServer] Week document does not exist for uid: ${uid}, weekId: ${weekId}`);
      return 0;
    }
    
    const weekData = weekDoc.data() as WeekDocument;
    const count = weekData?.ventEntryCount || 0;
    console.log(`[getWeekVentCountServer] Week ${weekId} has ${count} vent entries`);
    return count;
  } catch (err: any) {
    console.error(`[getWeekVentCountServer] Error getting vent count for ${uid}/${weekId}:`, err);
    return 0;
  }
}
