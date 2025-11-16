import { json } from '@sveltejs/kit';
import type { RequestHandler } from '../$types';
import { saveJournalEntry } from '$lib/services/firestore';


/**
 * POST /api/journal/save
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