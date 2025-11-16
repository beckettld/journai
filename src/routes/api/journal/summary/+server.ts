import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getWeeklyJournalEntries } from '$lib/services/firestore';
import { generateWeeklySummary } from '$lib/server/llm';

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
    const summary = await generateWeeklySummary(entries);
    return json({
      success: true,
      summary,
    });
  } catch (err: any) {
    console.error('Failed to summarize journal entries:', err);
    return json(
      { success: false, error: err.message || 'Unable to load summary' },
      { status: err.status || 500 }
    );
  }
};
