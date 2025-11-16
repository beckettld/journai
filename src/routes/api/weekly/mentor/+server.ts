import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { elaborate } from '$lib/server/llm';

type MentorRequestBody = {
  content: string;
  uid?: string;
  weekId?: string;
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { content }: MentorRequestBody = await request.json();

    if (!content || typeof content !== 'string') {
      return json({ success: false, error: 'content is required' }, { status: 400 });
    }

    const reply = await elaborate({ content });

    return json({ success: true, reply });
  } catch (err: any) {
    console.error('Weekly mentor API error:', err);
    return json(
      { success: false, error: err?.message || 'Unable to process mentor response.' },
      { status: 500 }
    );
  }
};
