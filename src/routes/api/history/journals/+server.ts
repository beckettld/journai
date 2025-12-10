import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllJournalEntries } from '$lib/services/firestore';

export const GET: RequestHandler = async ({ url }) => {
  const uid = url.searchParams.get('uid');

  if (!uid) {
    return json({ success: false, error: 'Missing required parameter: uid' }, { status: 400 });
  }

  try {
    const entries = await getAllJournalEntries(uid);
    return json({ success: true, entries });
  } catch (err: any) {
    console.error('Failed to load journal history:', err);
    return json(
      { success: false, error: err.message || 'Unable to load journal history' },
      { status: err.status || 500 }
    );
  }
};
