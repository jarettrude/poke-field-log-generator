import { getDatabase } from '@/lib/db/adapter';
import { successResponse, errorResponse } from '@/lib/server/api';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = await getDatabase();
    const prompts = await db.getAllPrompts();

    return successResponse(prompts);
  } catch (error) {
    console.error('Error fetching prompts:', error);
    return errorResponse('Failed to fetch prompts', 500);
  }
}

export async function POST(request: Request) {
  try {
    const { type, content } = await request.json();

    if (!type || !content) {
      return errorResponse('Type and content are required', 400);
    }

    const db = await getDatabase();
    await db.savePrompt({ type, content });

    return successResponse({ saved: true });
  } catch (error) {
    console.error('Error saving prompt:', error);
    return errorResponse('Failed to save prompt', 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type) {
      return errorResponse('Type parameter is required', 400);
    }

    const db = await getDatabase();
    await db.deletePrompt(type);

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('Error deleting prompt:', error);
    return errorResponse('Failed to delete prompt', 500);
  }
}
