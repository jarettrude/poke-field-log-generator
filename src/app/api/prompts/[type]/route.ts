import { getDatabase } from '@/lib/db/adapter';
import { successResponse, errorResponse } from '@/lib/server/api';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ type: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { type } = await params;
    const db = await getDatabase();
    const prompt = await db.getPrompt(type);

    if (!prompt) {
      return successResponse(null);
    }

    return successResponse(prompt);
  } catch (error) {
    console.error('Error fetching prompt:', error);
    return errorResponse('Failed to fetch prompt', 500);
  }
}
