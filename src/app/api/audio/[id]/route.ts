import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/adapter';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/audio/[id] - Get a single audio log
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = await getDatabase();
    const audioLog = await db.getAudioLog(parseInt(id));

    if (!audioLog) {
      return NextResponse.json({ error: 'Audio log not found' }, { status: 404 });
    }

    return NextResponse.json(audioLog);
  } catch (error) {
    console.error('Error fetching audio log:', error);
    return NextResponse.json({ error: 'Failed to fetch audio log' }, { status: 500 });
  }
}

// DELETE /api/audio/[id] - Delete an audio log
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = await getDatabase();
    await db.deleteAudioLog(parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting audio log:', error);
    return NextResponse.json({ error: 'Failed to delete audio log' }, { status: 500 });
  }
}
