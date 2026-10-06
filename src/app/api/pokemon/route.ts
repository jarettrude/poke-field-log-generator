import { getDatabase } from '@/lib/db/adapter';
import { errorResponse, successResponse } from '@/lib/server/api';

export const runtime = 'nodejs';

/**
 * GET /api/pokemon
 *
 * Returns slim media/classification rows for every cached Pokémon in a single
 * query. Used by list views so they don't have to fetch /api/pokemon/[id] once
 * per entry.
 */
export async function GET() {
  try {
    const db = await getDatabase();
    return successResponse(await db.getAllCachedPokemonMedia());
  } catch (error) {
    console.error('Error fetching cached pokemon media:', error);
    return errorResponse('Failed to fetch pokemon media', 500);
  }
}
