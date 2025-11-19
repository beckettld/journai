import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isUserAdmin, getWeekVentCountServer } from '$lib/services/firestore-server';

/**
 * GET /api/mentor/availability
 * 
 * Check if a user can access mentor sessions
 * 
 * Query params:
 *   uid: string (required)
 *   weekId: string (required)
 * 
 * Response:
 * {
 *   available: boolean;
 *   ventCount: number;
 *   isAdmin: boolean;
 *   reason?: string;
 * }
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const uid = url.searchParams.get('uid');
    const weekId = url.searchParams.get('weekId');

    console.log(`[Mentor Availability] Checking for uid: ${uid}, weekId: ${weekId}`);

    if (!uid || !weekId) {
      throw error(400, 'Missing required query parameters: uid, weekId');
    }

    // Check if user is admin
    let isAdmin = false;
    try {
      isAdmin = await isUserAdmin(uid);
      console.log(`[Mentor Availability] Admin check result: ${isAdmin}`);
    } catch (adminErr: any) {
      console.error('[Mentor Availability] Error checking admin status:', adminErr);
      // Continue with isAdmin = false if check fails
    }
    
    // Get vent count for the week
    let ventCount = 0;
    try {
      ventCount = await getWeekVentCountServer(uid, weekId);
      console.log(`[Mentor Availability] Vent count: ${ventCount}`);
    } catch (ventErr: any) {
      console.error('[Mentor Availability] Error getting vent count:', ventErr);
      // Continue with ventCount = 0 if check fails
    }
    
    // Admin users can always access mentor sessions
    // Regular users need 5+ vent sessions
    const available = isAdmin || ventCount >= 5;

    console.log(`[Mentor Availability] Final result - available: ${available}, isAdmin: ${isAdmin}, ventCount: ${ventCount}`);

    return json({
      available,
      ventCount,
      isAdmin,
      reason: available 
        ? (isAdmin ? 'Admin access' : 'Required vent sessions completed')
        : `Need ${5 - ventCount} more vent sessions`,
    });
  } catch (err: any) {
    console.error('[Mentor Availability] Fatal error:', err);
    return json(
      { 
        success: false, 
        error: err.message,
        available: false,
        ventCount: 0,
        isAdmin: false,
      },
      { status: err.status || 500 }
    );
  }
};

