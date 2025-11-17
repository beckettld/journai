import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  Timestamp,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '$lib/firebase/client';
import type { Message } from '$lib/stores/sessionStore';

export type JournalEntry = {
  id: string;
  date: string;
  content: string;
}

export type ChatEntry = {
  id: string;
  mode: 'vent' | 'mentor';
  timestamp: number;
  messages: Message[];
  summary?: string;
};

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
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
};

export type WeekDocument = {
  weekId: string;
  ventEntryCount: number;
  lastVentSessionAt?: Timestamp; // When the last vent session was completed
  createdAt: Timestamp;
  lastUpdated: Timestamp;
};

/**
 * Create or update a user document in Firestore
 * Path: /users/{uid}
 * This should be called when a user authenticates for the first time
 */
export async function createOrUpdateUser(
  uid: string,
  userData: {
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
  }
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const userDoc = await getDoc(userRef);

  const now = Timestamp.now();

  if (!userDoc.exists()) {
    // Create new user document
    await setDoc(userRef, {
      uid,
      email: userData.email,
      displayName: userData.displayName,
      photoURL: userData.photoURL,
      createdAt: now,
      lastLoginAt: now,
    });
  } else {
    // Update existing user document (update lastLoginAt)
    await setDoc(
      userRef,
      {
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        lastLoginAt: now,
      },
      { merge: true }
    );
  }
}

/**
 * Create or initialize a week document
 * Path: /users/{uid}/weeks/{weekId}
 */
export async function createOrUpdateWeek(uid: string, weekId: string): Promise<void> {
  const weekRef = doc(db, `users/${uid}/weeks`, weekId);
  const weekDoc = await getDoc(weekRef);

  const now = Timestamp.now();

  if (!weekDoc.exists()) {
    // Create new week document
    await setDoc(weekRef, {
      weekId,
      ventEntryCount: 0,
      createdAt: now,
      lastUpdated: now,
    });
  } else {
    // Update lastUpdated timestamp
    await setDoc(
      weekRef,
      {
        lastUpdated: now,
      },
      { merge: true }
    );
  }
}

/**
 * Get the vent entry count for a week
 */
export async function getWeekVentCount(uid: string, weekId: string): Promise<number> {
  const weekRef = doc(db, `users/${uid}/weeks`, weekId);
  const weekDoc = await getDoc(weekRef);

  if (!weekDoc.exists()) {
    return 0;
  }

  const data = weekDoc.data() as WeekDocument;
  return data.ventEntryCount || 0;
}

/**
 * Get the week document
 */
export async function getWeekDocument(uid: string, weekId: string): Promise<WeekDocument | null> {
  const weekRef = doc(db, `users/${uid}/weeks`, weekId);
  const weekDoc = await getDoc(weekRef);

  if (!weekDoc.exists()) {
    return null;
  }

  return {
    weekId,
    ...weekDoc.data(),
  } as WeekDocument;
}

export async function saveJournalEntry(uid: string, date: string, content: string): Promise<void> {
  const ref = doc(db, `users/${uid}/journal`, date);
  await setDoc(ref, {
    date,
    content,
    lastUpdated: Timestamp.now()
  }, { merge: true });
}

export async function getJournalEntry(uid: string, date: string): Promise<string> {
  const ref = doc(db, `users/${uid}/journal`, date);
  const snap = await getDoc(ref);

  if (!snap.exists()){
    throw new Error('journal entry does not exist!');
  }
  return snap.data().content;

}



/**
 * Check if user can start a new vent session (12 hour cooldown)
 */
export async function canStartVentSession(uid: string, weekId: string): Promise<{
  canStart: boolean;
  lastSessionAt?: Date;
  hoursRemaining?: number;
}> {
  const weekDoc = await getWeekDocument(uid, weekId);
  
  if (!weekDoc || !weekDoc.lastVentSessionAt) {
    return { canStart: true };
  }

  const lastSessionTime = weekDoc.lastVentSessionAt.toDate();
  const now = new Date();
  const hoursSinceLastSession = (now.getTime() - lastSessionTime.getTime()) / (1000 * 60 * 60);
  const hoursRemaining = 12 - hoursSinceLastSession;

  if (hoursSinceLastSession >= 12) {
    return { canStart: true };
  }

  return {
    canStart: false,
    lastSessionAt: lastSessionTime,
    hoursRemaining: Math.max(0, hoursRemaining),
  };
}

/**
 * Save an active session draft (for restoring when user returns)
 * Path: /users/{uid}/weeks/{weekId}/drafts/{entryId}
 */
export async function saveSessionDraft(
  uid: string,
  weekId: string,
  entryId: string,
  data: {
    mode: 'vent' | 'mentor';
    messages: Message[];
    startTime: number;
    durationMinutes: number;
  }
): Promise<void> {
  const draftRef = doc(db, `users/${uid}/weeks/${weekId}/drafts`, entryId);
  await setDoc(draftRef, {
    ...data,
    lastUpdated: Timestamp.now(),
  });
}

/**
 * Get an active session draft
 */
export async function getSessionDraft(
  uid: string,
  weekId: string,
  entryId: string
): Promise<{
  mode: 'vent' | 'mentor';
  messages: Message[];
  startTime: number;
  durationMinutes: number;
} | null> {
  const draftRef = doc(db, `users/${uid}/weeks/${weekId}/drafts`, entryId);
  const draftDoc = await getDoc(draftRef);

  if (!draftDoc.exists()) {
    return null;
  }

  const data = draftDoc.data();
  return {
    mode: data.mode,
    messages: data.messages || [],
    startTime: data.startTime,
    durationMinutes: data.durationMinutes,
  };
}

/**
 * Delete a session draft (when session is completed)
 */
export async function deleteSessionDraft(
  uid: string,
  weekId: string,
  entryId: string
): Promise<void> {
  const draftRef = doc(db, `users/${uid}/weeks/${weekId}/drafts`, entryId);
  const draftDoc = await getDoc(draftRef);
  if (draftDoc.exists()) {
    await deleteDoc(draftRef);
  }
}

/**
 * Save a vent session to the ventSessions collection
 * Path: /users/{uid}/weeks/{weekId}/ventSessions/{sessionId}
 * Also updates the vent entry count in the week document
 */
export async function saveVentSession(
  uid: string,
  weekId: string,
  sessionId: string,
  data: {
    startTime: number;
    durationMinutes: number;
    messages: Message[];
  }
): Promise<void> {
  // Ensure week document exists first
  await createOrUpdateWeek(uid, weekId);

  const sessionPath = `users/${uid}/weeks/${weekId}/ventSessions/${sessionId}`;
  console.log('Saving vent session to:', sessionPath);
  
  const sessionRef = doc(db, `users/${uid}/weeks/${weekId}/ventSessions`, sessionId);
  const sessionDoc = await getDoc(sessionRef);
  const isNewSession = !sessionDoc.exists();

  const now = Timestamp.now();

  // Save the vent session
  const sessionData = {
    startTime: data.startTime,
    durationMinutes: data.durationMinutes,
    messages: data.messages,
    completedAt: now,
    createdAt: isNewSession ? now : sessionDoc.data()?.createdAt || now,
    lastUpdated: now,
  };
  
  console.log('Saving vent session data:', { sessionId, isNewSession, messageCount: data.messages.length });
  await setDoc(sessionRef, sessionData);
  console.log('Vent session saved successfully');

  // If it's a new session, increment the vent count and update lastVentSessionAt
  if (isNewSession) {
    const weekRef = doc(db, `users/${uid}/weeks`, weekId);
    const weekDoc = await getDoc(weekRef);

    if (weekDoc.exists()) {
      const currentCount = (weekDoc.data() as WeekDocument).ventEntryCount || 0;
      await setDoc(
        weekRef,
        {
          ventEntryCount: currentCount + 1,
          lastVentSessionAt: now,
          lastUpdated: now,
        },
        { merge: true }
      );
    }
  }
}

/**
 * Get a specific vent session
 */
export async function getVentSession(
  uid: string,
  weekId: string,
  sessionId: string
): Promise<VentSession | null> {
  const sessionRef = doc(db, `users/${uid}/weeks/${weekId}/ventSessions`, sessionId);
  const sessionDoc = await getDoc(sessionRef);

  if (!sessionDoc.exists()) {
    return null;
  }

  const data = sessionDoc.data();
  return {
    id: sessionDoc.id,
    startTime: data.startTime,
    durationMinutes: data.durationMinutes,
    messages: data.messages || [],
    completedAt: data.completedAt,
    createdAt: data.createdAt,
    lastUpdated: data.lastUpdated,
  };
}

/**
 * Get all vent sessions for a specific week
 */
export async function getWeeklyVentSessions(
  uid: string,
  weekId: string
): Promise<VentSession[]> {
  const sessionsRef = collection(db, `users/${uid}/weeks/${weekId}/ventSessions`);
  const q = query(sessionsRef, orderBy('createdAt', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  } as VentSession));
}

/**
 * Save or update a chat entry (for mentor sessions only - vent sessions use saveVentSession)
 * Path: /users/{uid}/weeks/{weekId}/entries/{entryId}
 */
export async function saveChatEntry(
  uid: string,
  weekId: string,
  entryId: string,
  data: {
    mode: 'vent' | 'mentor';
    messages: Message[];
    summary?: string;
  }
) {
  // Vent sessions should use saveVentSession instead
  if (data.mode === 'vent') {
    throw new Error('Vent sessions should use saveVentSession() instead of saveChatEntry()');
  }

  // Only mentor sessions use this function
  const entryRef = doc(db, `users/${uid}/weeks/${weekId}/entries`, entryId);
  await setDoc(entryRef, {
    ...data,
    lastUpdated: Timestamp.now(),
  });
}

/**
 * Get a specific chat entry
 */
export async function getChatEntry(uid: string, weekId: string, entryId: string) {
  const ref = doc(db, `users/${uid}/weeks/${weekId}/entries`, entryId);
  const snapshot = await getDoc(ref);
  return snapshot.data() as ChatEntry | undefined;
}

/**
 * Get all vent entries for a specific week (converts VentSession to ChatEntry format for compatibility)
 * @deprecated Use getWeeklyVentSessions() for new code
 */
export async function getWeeklyVentEntries(uid: string, weekId: string): Promise<ChatEntry[]> {
  const sessions = await getWeeklyVentSessions(uid, weekId);
  return sessions.map((session) => ({
    id: session.id,
    mode: 'vent' as const,
    timestamp: session.startTime,
    messages: session.messages,
  }));
}

/**
 * Get all entries for a specific week (both vent sessions and mentor entries)
 */
export async function getWeeklyEntries(uid: string, weekId: string): Promise<ChatEntry[]> {
  // Get vent sessions
  const ventSessions = await getWeeklyVentSessions(uid, weekId);
  const ventEntries: ChatEntry[] = ventSessions.map((session) => ({
    id: session.id,
    mode: 'vent' as const,
    timestamp: session.startTime,
    messages: session.messages,
  }));

  // Get mentor entries
  const entriesRef = collection(db, `users/${uid}/weeks/${weekId}/entries`);
  const q = query(entriesRef, orderBy('lastUpdated', 'asc'));
  const snapshot = await getDocs(q);
  const mentorEntries: ChatEntry[] = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  } as ChatEntry));

  // Combine and sort by timestamp (mentor entries use lastUpdated if no timestamp)
  return [...ventEntries, ...mentorEntries].sort((a, b) => {
    const aTime = a.timestamp || 0;
    const bTime = b.timestamp || 0;
    return aTime - bTime;
  });
}

/**
 * Summarize vent entries for the weekly mentor session
 */
export function summarizeVentEntries(entries: ChatEntry[]): string {
  if (entries.length === 0) {
    return 'No vent entries this week.';
  }

  const allMessages = entries.flatMap((entry) =>
    entry.messages.filter((msg) => msg.role === 'user').map((msg) => msg.content)
  );

  const summary = allMessages.join('\n\n---\n\n');
  return `Here's what you shared with me this week:\n\n${summary}`;
}

