import { getDatabase } from '@/lib/db/adapter';
import { successResponse, errorResponse } from '@/lib/server/api';

export const runtime = 'nodejs';

// GET /api/summaries - Get all summaries
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const generationIdParam = searchParams.get('generationId');

    const db = await getDatabase();

    let summaries;
    if (generationIdParam) {
      const generationId = parseInt(generationIdParam, 10);
      if (!Number.isFinite(generationId) || generationId <= 0) {
        return errorResponse('Invalid generationId', 400);
      }
      summaries = await db.getSummariesByGeneration(generationId);
    } else {
      summaries = await db.getAllSummaries();
    }

    return successResponse(summaries);
  } catch (error) {
    console.error('Error fetching summaries:', error);
    return errorResponse('Failed to fetch summaries', 500);
  }
}

// POST /api/summaries - Save a summary
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, summary, region, generationId } = body;

    if (
      typeof id !== 'number' || id <= 0 ||
      typeof name !== 'string' || !name ||
      typeof summary !== 'string' || !summary ||
      typeof region !== 'string' || !region ||
      typeof generationId !== 'number' || generationId <= 0
    ) {
      return errorResponse('Missing or invalid required fields', 400);
    }

    const db = await getDatabase();
    await db.saveSummary({ id, name, summary, region, generationId });

    return successResponse({ saved: true });
  } catch (error) {
    console.error('Error saving summary:', error);
    return errorResponse('Failed to save summary', 500);
  }
}

// DELETE /api/summaries - Delete summaries by IDs
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids)) {
      return errorResponse('Missing or invalid ids array', 400);
    }

    const uniqueIds = Array.from(new Set(
      ids
        .map(id => Number(id))
        .filter(id => Number.isFinite(id) && id > 0)
        .map(id => Math.trunc(id))
    ));

    if (uniqueIds.length === 0) {
      return errorResponse('No valid IDs provided', 400);
    }

    const db = await getDatabase();
    for (const id of uniqueIds) {
      await db.deleteSummary(id);
    }

    return successResponse({ deleted: uniqueIds.length });
  } catch (error) {
    console.error('Error deleting summaries:', error);
    return errorResponse('Failed to delete summaries', 500);
  }
}
