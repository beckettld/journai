import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callLLM, SYSTEM_PROMPTS } from '$lib/server/llm';
import { getWeeklyJournalEntries, summarizeJournalEntries } from '$lib/services/firestore';
import { isUserAdmin, getWeekVentCountServer } from '$lib/services/firestore-server';

/**
 * POST /api/chat
 * 
 * Orchestrates message routing between VentAgent and MentorAgent
 * 
 * Request body:
 * {
 *   message: string;
 *   mode: 'vent' | 'mentor';
 *   history: Array<{ role: 'user' | 'assistant', content: string }>;
 *   uid: string;
 *   weekId: string;
 * }
 * 
 * Response:
 * {
 *   reply: string;
 *   success: boolean;
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { message, mode, history, uid, weekId } = await request.json();

    if (!message || !mode || !uid || !weekId) {
      throw error(400, 'Missing required fields: message, mode, uid, weekId');
    }

    // For mentor mode, check if user has access (admin or 5+ vent sessions)
    if (mode === 'mentor') {
      const isAdmin = await isUserAdmin(uid);
      const ventCount = await getWeekVentCountServer(uid, weekId);
      
      if (!isAdmin && ventCount < 5) {
        throw error(403, 'Mentor sessions require 5 completed vent sessions or admin access');
      }
    }

    let systemPrompt = SYSTEM_PROMPTS[mode as keyof typeof SYSTEM_PROMPTS];
    let context = '';

    // For mentor mode, fetch and summarize the week's journal entries
    if (mode === 'mentor' && uid && weekId) {
      try {
        const journalEntries = await getWeeklyJournalEntries(uid, weekId);
        context = summarizeJournalEntries(journalEntries);
      } catch (firestoreError) {
        console.error('Error fetching journal entries:', firestoreError);
        // Continue without context if Firestore fetch fails
      }
    }

    console.log('--- Debug Chat History ---');
console.log('Raw history from frontend:', JSON.stringify(history, null, 2));
console.log('Message to be added:', JSON.stringify({ role: 'user', content: message }, null, 2));

const messagesToSend = [
  ...(history || []),
  { role: 'user', content: message },
];

console.log('Combined messages going to callLLM:', JSON.stringify(messagesToSend, null, 2));


    const reply = await callLLM({
      system: systemPrompt,
      messages: [
        ...(history || []),
        { role: 'user', content: message },
      ],
      context,
    });

    return json({
      reply,
      success: true,
    });
  } catch (err: any) {
    console.error('Chat API error:', err);
    return json(
      { success: false, error: err.message },
      { status: err.status || 500 }
    );
  }
};

/**
 * API Documentation for UI Designers
 * 
 * ENDPOINT: POST /api/chat
 * 
 * PURPOSE: Route user messages to the appropriate AI agent (VentAgent or MentorAgent)
 * 
 * REQUEST BODY:
 * {
 *   message: string;           // The user's input message
 *   mode: "vent" | "mentor";   // Session mode determines which agent is used
 *   history: Array<{           // Previous messages in this session
 *     role: "user" | "assistant";
 *     content: string;
 *   }>;
 *   uid: string;               // Firebase user ID (needed for context retrieval)
 *   weekId: string;            // Week ID in format "YYYY-Www" (e.g., "2025-W45")
 * }
 * 
 * RESPONSE (200 OK):
 * {
 *   reply: string;             // AI's response message
 *   success: boolean;          // True if successful
 * }
 * 
 * RESPONSE (400 Bad Request):
 * {
 *   success: false;
 *   error: string;             // Error message
 * }
 * 
 * BEHAVIOR:
 * 
 * 1. VENT MODE (mode: "vent")
 *    - Uses VentAgent system prompt (reflective, no advice)
 *    - No context fetching needed
 *    - Response: 2-3 sentences reflecting/questioning
 * 
 * 2. MENTOR MODE (mode: "mentor")
 *    - Uses MentorAgent system prompt (analytical, advice-giving)
 *    - Fetches the user's journal entries from the current week (from Firestore)
 *    - Summarizes those entries and includes as context
 *    - Response: Structured format (What I Heard / Key Patterns / Your Focus)
 * 
 * FRONTEND USAGE:
 * 
 * const response = await fetch('/api/chat', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     message: userInput,
 *     mode: sessionMode,  // 'vent' or 'mentor'
 *     history: sessionMessages,
 *     uid: currentUser.uid,
 *     weekId: currentWeekId,  // e.g., "2025-W45"
 *   })
 * });
 * 
 * const data = await response.json();
 * if (data.success) {
 *   addMessageToChat({ role: 'assistant', content: data.reply });
 * }
 */
