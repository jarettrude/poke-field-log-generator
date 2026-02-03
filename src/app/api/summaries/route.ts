import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/adapter';

// GET /api/summaries - Get all summaries
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const generationId = searchParams.get('generationId');

    const db = await getDatabase();

    let summaries;
    if (generationId) {
      summaries = await db.getSummariesByGeneration(parseInt(generationId));
    } else {
      summaries = await db.getAllSummaries();
    }

    return NextResponse.json(summaries);
  } catch (error) {
    console.error('Error fetching summaries:', error);
    return NextResponse.json({ error: 'Failed to fetch summaries' }, { status: 500 });
  }
}

// POST /api/summaries - Save a summary
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, summary, region, generationId } = body;

    if (!id || !name || !summary || !region || !generationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = await getDatabase();
    await db.saveSummary({ id, name, summary, region, generationId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving summary:', error);
    return NextResponse.json({ error: 'Failed to save summary' }, { status: 500 });
  }
}
