import { getDatabase } from '@/lib/db/adapter';
import { successResponse, errorResponse } from '@/lib/server/api';

export const runtime = 'nodejs';

// GET /api/audio - Get all audio logs metadata (optionally filter by generationId)
// Returns metadata only (no audioBase64) to prevent RangeError on large datasets
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const generationIdParam = searchParams.get('generationId');

    const db = await getDatabase();

    // Use metadata-only methods to avoid JSON serialization issues with large audio data
    const audioLogs = generationIdParam
      ? await db.getAudioLogsMetadataByGeneration(parseInt(generationIdParam))
      : await db.getAllAudioLogsMetadata();

    return successResponse(audioLogs);
  } catch (error) {
    console.error('Error fetching audio logs:', error);
    return errorResponse('Failed to fetch audio logs', 500);
  }
}

// POST /api/audio - Save an audio log
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, region, generationId, voice, audioBase64, audioFormat, bitrate } = body;

    if (
      typeof id !== 'number' ||
      id <= 0 ||
      typeof name !== 'string' ||
      !name ||
      typeof region !== 'string' ||
      !region ||
      typeof generationId !== 'number' ||
      generationId <= 0 ||
      typeof voice !== 'string' ||
      !voice ||
      typeof audioBase64 !== 'string' ||
      !audioBase64 ||
      audioFormat !== 'mp3' ||
      typeof bitrate !== 'number' ||
      bitrate <= 0
    ) {
      return errorResponse('Missing or invalid required fields', 400);
    }

    const db = await getDatabase();
    await db.saveAudioLog({
      id,
      name,
      region,
      generationId,
      voice,
      audioBase64,
      audioFormat,
      bitrate,
    });

    return successResponse({ saved: true });
  } catch (error) {
    console.error('Error saving audio log:', error);
    return errorResponse('Failed to save audio log', 500);
  }
}

// DELETE /api/audio - Delete audio logs by IDs
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids)) {
      return errorResponse('Missing or invalid ids array', 400);
    }

    const uniqueIds = Array.from(
      new Set(
        ids
          .map(id => Number(id))
          .filter(id => Number.isFinite(id) && id > 0)
          .map(id => Math.trunc(id))
      )
    );

    if (uniqueIds.length === 0) {
      return errorResponse('No valid IDs provided', 400);
    }

    const db = await getDatabase();
    for (const id of uniqueIds) {
      await db.deleteAudioLog(id);
    }

    return successResponse({ deleted: uniqueIds.length });
  } catch (error) {
    console.error('Error deleting audio logs:', error);
    return errorResponse('Failed to delete audio logs', 500);
  }
}
