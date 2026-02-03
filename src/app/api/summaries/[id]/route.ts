import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/adapter';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/summaries/[id] - Get a single summary
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = await getDatabase();
    const summary = await db.getSummary(parseInt(id));

    if (!summary) {
      return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
    }

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}

// DELETE /api/summaries/[id] - Delete a summary
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = await getDatabase();
    await db.deleteSummary(parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting summary:', error);
    return NextResponse.json({ error: 'Failed to delete summary' }, { status: 500 });
  }
}
