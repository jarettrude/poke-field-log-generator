import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/adapter';

export async function GET() {
  try {
    const db = await getDatabase();
    const prompts = await db.getAllPrompts();

    return NextResponse.json(prompts);
  } catch (error) {
    console.error('Error fetching prompts:', error);
    return NextResponse.json({ error: 'Failed to fetch prompts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { type, content } = await request.json();

    if (!type || !content) {
      return NextResponse.json({ error: 'Type and content are required' }, { status: 400 });
    }

    const db = await getDatabase();
    await db.savePrompt({ type, content });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving prompt:', error);
    return NextResponse.json({ error: 'Failed to save prompt' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type) {
      return NextResponse.json({ error: 'Type parameter is required' }, { status: 400 });
    }

    const db = await getDatabase();
    await db.deletePrompt(type);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting prompt:', error);
    return NextResponse.json({ error: 'Failed to delete prompt' }, { status: 500 });
  }
}
