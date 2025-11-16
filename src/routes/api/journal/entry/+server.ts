import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '../$types';
import { getJournalEntry, saveJournalEntry } from '$lib/services/firestore';


/**
 * POST /api/journal/entry
 * 
 * Saves the entry to the database 
 * 
 * Request body: {
 * uid: string
 * date: string
 * content: string
 * }
 * 
 * Response: { success: boolean; uid: string; }
 * 
 */

export const POST: RequestHandler = async ({ request }) => {
  
  try {
    const {uid, date, content} = await request.json();
    await saveJournalEntry(uid, date, content)

    return json({
      uid,
      success: true,
    });
  } catch(err: any) {
    console.error('Error saving journal entry:', err);
    return json(
      { success: false, error: err.message },
      { status: err.status || 500 }
    );
  }
}

/**
 * GET /api/journal/entry
 * 
 * Gets the entry from the database 
 * 
 * Query parameters:
 * ?uid={uid}&date={date}
 * 
 * Response: { success: boolean; content: string; }
 * 
 */

export const GET: RequestHandler = async ({ url }) => {
  try {
    const uid = url.searchParams.get('uid');
    const date = url.searchParams.get('date');

    if (!uid || !date) {
          throw error(400, 'Missing required parameters: uid, weekId');
        }
    const entry = await getJournalEntry(uid, date);
    
    return json({
      success: true,
      content: entry,
    });

  } catch (err: any) {
    console.error('Error fetching logs:', err);
    return json(
      { success: false, error: err.message },
      { status: err.status || 500 }
    );
  }
}