import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/adapter';

// GET /api/audio - Get all audio logs (optionally filter by generationId)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const generationId = searchParams.get('generationId');

    const db = await getDatabase();

    const audioLogs = generationId
      ? await db.getAudioLogsByGeneration(parseInt(generationId))
      : await db.getAllAudioLogs();

    return NextResponse.json(audioLogs);
  } catch (error) {
    console.error('Error fetching audio logs:', error);
    return NextResponse.json({ error: 'Failed to fetch audio logs' }, { status: 500 });
  }
}

// POST /api/audio - Save an audio log
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, region, generationId, voice, audioBase64, audioFormat, sampleRate } = body;

    if (
      !id ||
      !name ||
      !region ||
      !generationId ||
      !voice ||
      !audioBase64 ||
      !audioFormat ||
      !sampleRate
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
      sampleRate,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving audio log:', error);
    return NextResponse.json({ error: 'Failed to save audio log' }, { status: 500 });
  }
}
