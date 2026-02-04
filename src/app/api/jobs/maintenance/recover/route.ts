import { getDatabase } from '@/lib/db/adapter';
import { successResponse, errorResponse } from '@/lib/server/api';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { stalledThresholdMs?: number };
    const stalledThresholdMs =
      typeof body.stalledThresholdMs === 'number' && Number.isFinite(body.stalledThresholdMs)
        ? body.stalledThresholdMs
        : 5 * 60 * 1000;

    const db = await getDatabase();
    const recoveredCount = await db.recoverStalledJobs(stalledThresholdMs);

    return successResponse({ recoveredCount });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return errorResponse(msg, 500);
  }
}
