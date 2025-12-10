import type { RequestHandler } from '@sveltejs/kit';
import { getWeeklyEntries } from '$lib/services/firestore';

export const GET: RequestHandler = async ({ url }) => {
  const uid = url.searchParams.get('uid');
  const weekId = url.searchParams.get('weekId');

  if (!uid || !weekId) {
    return new Response(JSON.stringify({ success: false, error: 'Missing uid or weekId' }), {
      status: 400,
    });
  }

  try {
    const entries = await getWeeklyEntries(uid, weekId);
    const mentorEntries = entries.filter((e) => e.mode === 'mentor');
    return new Response(JSON.stringify({ success: true, entries: mentorEntries }));
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Failed to fetch mentor sessions' }),
      { status: 500 }
    );
  }
};
