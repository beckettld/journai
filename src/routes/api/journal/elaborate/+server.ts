import { json } from '@sveltejs/kit';
import type { RequestHandler } from '../$types';

/**
 * POST /api/journal/elaborate
 * 
 * LLM response to the user journal entry so far - asks user to elaborate
 * 
 */

import { elaborate, type ElaborateRequest } from "$lib/server/llm";

export const POST: RequestHandler = async ({ request }) => {
  const { content } = await request.json();
  try {
    const elaborateRequest: ElaborateRequest = {
        content: content
    };
    const response = await elaborate(elaborateRequest);
    return json({
          response,
          success: true,
        });
  } catch(err: any) {
    console.error('Error getting elaboration agent response:', err);
    return json(
      { success: false, error: err.message },
      { status: err.status || 500 }
    );
  }
}