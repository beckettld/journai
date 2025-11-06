import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { saveChatEntry, getWeeklyVentEntries, getWeeklyEntries } from '$lib/services/firestore';
import { saveVentSessionServer } from '$lib/services/firestore-server';

/**
 * POST /api/logs
 * Save a chat entry (vent or mentor session)
 * 
 * Request body:
 * {
 *   uid: string;
 *   weekId: string;
 *   entryId: string;  // YYYY-MM-DD for daily, "mentor" for weekly
 *   mode: "vent" | "mentor";
 *   messages: Array<{ role: string, content: string }>;
 *   summary?: string;  // Optional summary
 * }
 * 
 * Response: { success: boolean; entryId: string; }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { uid, weekId, entryId, mode, messages, summary, startTime, durationMinutes } =
      await request.json();

    if (!uid || !weekId || !entryId || !mode || !messages) {
      throw error(400, 'Missing required fields');
    }

    if (mode === 'vent') {
      // Vent sessions go to ventSessions collection (using server-side function)
      if (!startTime || !durationMinutes) {
        throw error(400, 'Missing required fields for vent session: startTime, durationMinutes');
      }
      try {
        console.log('Saving vent session (server-side):', { uid, weekId, entryId, startTime });
        await saveVentSessionServer(uid, weekId, entryId, {
          startTime,
          durationMinutes,
          messages,
        });
        console.log('Vent session saved successfully to ventSessions collection');
      } catch (saveError: any) {
        console.error('Error saving vent session:', saveError);
        throw error(500, `Failed to save vent session: ${saveError.message}`);
      }
    } else {
      // Mentor sessions go to entries collection
      await saveChatEntry(uid, weekId, entryId, {
        mode,
        messages,
        summary,
      });
    }

    return json({
      success: true,
      entryId,
    });
  } catch (err: any) {
    console.error('Error saving log:', err);
    return json(
      { success: false, error: err.message },
      { status: err.status || 500 }
    );
  }
};

/**
 * GET /api/logs
 * Retrieve vent entries for a week
 * 
 * Query parameters:
 * ?uid={uid}&weekId={weekId}&type={vent|all}
 * 
 * type=vent: Only vent entries
 * type=all: All entries (vent + mentor)
 * 
 * Response: { success: boolean; entries: ChatEntry[] }
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const uid = url.searchParams.get('uid');
    const weekId = url.searchParams.get('weekId');
    const type = url.searchParams.get('type') || 'vent';

    if (!uid || !weekId) {
      throw error(400, 'Missing required parameters: uid, weekId');
    }

    let entries: any[];

    if (type === 'all') {
      entries = await getWeeklyEntries(uid, weekId);
    } else {
      entries = await getWeeklyVentEntries(uid, weekId);
    }

    return json({
      success: true,
      entries,
    });
  } catch (err: any) {
    console.error('Error fetching logs:', err);
    return json(
      { success: false, error: err.message },
      { status: err.status || 500 }
    );
  }
};

/**
 * API Documentation for UI Designers
 * 
 * ============================================
 * ENDPOINT: POST /api/logs
 * ============================================
 * 
 * PURPOSE: Save a chat session (daily vent or weekly mentor) to Firestore
 * 
 * REQUEST BODY:
 * {
 *   uid: string;                  // Firebase user ID
 *   weekId: string;               // Week ID (e.g., "2025-W45")
 *   entryId: string;              // Date (e.g., "2025-11-05") or "mentor"
 *   mode: "vent" | "mentor";      // Session type
 *   messages: [                   // Complete message history
 *     { role: "user" | "assistant", content: string }
 *   ];
 *   summary?: string;             // Optional AI-generated summary
 * }
 * 
 * RESPONSE (200 OK):
 * {
 *   success: true;
 *   entryId: string;              // The ID that was saved
 * }
 * 
 * FIRESTORE PATH:
 * /users/{uid}/weeks/{weekId}/entries/{entryId}
 * 
 * USAGE IN FRONTEND:
 * 
 * // On session end (timer expires or user ends early):
 * await fetch('/api/logs', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     uid: user.uid,
 *     weekId: "2025-W45",
 *     entryId: "2025-11-05",  // For daily: date format YYYY-MM-DD
 *     mode: "vent",
 *     messages: [
 *       { role: 'user', content: 'I had a tough day...' },
 *       { role: 'assistant', content: 'Tell me more...' },
 *     ],
 *     summary: "Optional AI summary"
 *   })
 * });
 * 
 * ============================================
 * ENDPOINT: GET /api/logs
 * ============================================
 * 
 * PURPOSE: Retrieve chat entries for a week (used by mentor to fetch context)
 * 
 * QUERY PARAMETERS:
 * ?uid={uid}
 * &weekId={weekId}
 * &type=vent|all         // Optional: "vent" (default) or "all" for all entries
 * 
 * EXAMPLES:
 * GET /api/logs?uid=user123&weekId=2025-W45
 * GET /api/logs?uid=user123&weekId=2025-W45&type=vent
 * GET /api/logs?uid=user123&weekId=2025-W45&type=all
 * 
 * RESPONSE (200 OK):
 * {
 *   success: true;
 *   entries: [
 *     {
 *       id: "2025-11-03";          // Entry ID (date or "mentor")
 *       mode: "vent";               // "vent" or "mentor"
 *       timestamp: 1730000000;      // Unix timestamp
 *       messages: [                 // All messages in this entry
 *         { role: "user", content: "..." }
 *       ];
 *       summary?: string;           // Optional summary
 *       lastUpdated: {...};         // Firestore timestamp
 *     }
 *   ]
 * }
 * 
 * USAGE IN FRONTEND (Mentor Session Start):
 * 
 * // Before starting mentor chat, fetch the week's vent entries
 * const response = await fetch(
 *   `/api/logs?uid=${user.uid}&weekId=2025-W45&type=vent`
 * );
 * const data = await response.json();
 * const ventEntries = data.entries;  // Use these for context/display
 */

