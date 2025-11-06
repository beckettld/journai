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

