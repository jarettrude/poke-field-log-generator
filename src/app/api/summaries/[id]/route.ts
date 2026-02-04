import { getDatabase } from '@/lib/db/adapter';
import { successResponse, errorResponse, parseId } from '@/lib/server/api';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/summaries/[id] - Get a single summary
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const summaryId = parseId(id);

    if (!summaryId) {
      return errorResponse('Invalid ID', 400);
    }

    const db = await getDatabase();
    const summary = await db.getSummary(summaryId);

    if (!summary) {
      return errorResponse('Summary not found', 404);
    }

    return successResponse(summary);
  } catch (error) {
    console.error('Error fetching summary:', error);
    return errorResponse('Failed to fetch summary', 500);
  }
}

// DELETE /api/summaries/[id] - Delete a summary
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const summaryId = parseId(id);

    if (!summaryId) {
      return errorResponse('Invalid ID', 400);
    }

    const db = await getDatabase();
    await db.deleteSummary(summaryId);

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('Error deleting summary:', error);
    return errorResponse('Failed to delete summary', 500);
  }
}
