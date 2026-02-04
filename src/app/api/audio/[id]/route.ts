import { getDatabase } from '@/lib/db/adapter';
import { successResponse, errorResponse, parseId } from '@/lib/server/api';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/audio/[id] - Get a single audio log
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const audioId = parseId(id);
    
    if (!audioId) {
      return errorResponse('Invalid ID', 400);
    }

    const db = await getDatabase();
    const audioLog = await db.getAudioLog(audioId);

    if (!audioLog) {
      return errorResponse('Audio log not found', 404);
    }

    return successResponse(audioLog);
  } catch (error) {
    console.error('Error fetching audio log:', error);
    return errorResponse('Failed to fetch audio log', 500);
  }
}

// DELETE /api/audio/[id] - Delete an audio log
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const audioId = parseId(id);

    if (!audioId) {
      return errorResponse('Invalid ID', 400);
    }

    const db = await getDatabase();
    await db.deleteAudioLog(audioId);

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('Error deleting audio log:', error);
    return errorResponse('Failed to delete audio log', 500);
  }
}
