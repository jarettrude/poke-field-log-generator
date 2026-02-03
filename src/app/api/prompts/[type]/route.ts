import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/adapter';

interface RouteParams {
  params: Promise<{ type: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { type } = await params;
    const db = await getDatabase();
    const prompt = await db.getPrompt(type);

    if (!prompt) {
      return NextResponse.json(null);
    }

    return NextResponse.json(prompt);
  } catch (error) {
    console.error('Error fetching prompt:', error);
    return NextResponse.json({ error: 'Failed to fetch prompt' }, { status: 500 });
  }
}
