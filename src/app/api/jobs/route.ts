import { randomUUID } from 'crypto';
import { getDatabase } from '@/lib/db/adapter';
import { startJobRunner } from '@/lib/server/jobRunner';
import { successResponse, errorResponse } from '@/lib/server/api';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    startJobRunner();

    const body = await request.json();
    const { mode, generationId, region, voice, pokemonIds } = body as {
      mode: 'FULL' | 'SUMMARY_ONLY' | 'AUDIO_ONLY';
      generationId: number;
      region: string;
      voice: string;
      pokemonIds: number[];
    };

    if (
      (mode !== 'FULL' && mode !== 'SUMMARY_ONLY' && mode !== 'AUDIO_ONLY') ||
      typeof generationId !== 'number' ||
      typeof region !== 'string' ||
      typeof voice !== 'string' ||
      !Array.isArray(pokemonIds) ||
      pokemonIds.length === 0
    ) {
      return errorResponse('Invalid request body', 400);
    }

    const normalized = Array.from(new Set(pokemonIds))
      .map(n => Number(n))
      .filter(n => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);

    if (normalized.length === 0) {
      return errorResponse('No valid pokemonIds provided', 400);
    }

    const id = randomUUID();
    const db = await getDatabase();

    await db.createJob({
      id,
      mode,
      generationId,
      region,
      voice,
      pokemonIds: normalized,
    });

    return successResponse({ id });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return errorResponse(msg, 500);
  }
}
