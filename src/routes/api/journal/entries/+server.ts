import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getWeeklyJournalEntries } from '$lib/services/firestore';

export const GET: RequestHandler = async ({ url }) => {
  const uid = url.searchParams.get('uid');
  const weekId = url.searchParams.get('weekId');

  if (!uid || !weekId) {
    return json(
      { success: false, error: 'Missing required parameters: uid and weekId are required' },
      { status: 400 }
    );
  }

  try {
    const entries = await getWeeklyJournalEntries(uid, weekId);
    return json({
      success: true,
      entries,
    });
  } catch (err: any) {
    console.error('Failed to load weekly journal entries:', err);
    return json(
      { success: false, error: err.message || 'Unable to load journal entries' },
      { status: err.status || 500 }
    );
  }
};
