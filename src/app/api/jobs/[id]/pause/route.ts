import { getDatabase } from '@/lib/db/adapter';
import { startJobRunner } from '@/lib/server/jobRunner';
import { successResponse, errorResponse } from '@/lib/server/api';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    startJobRunner();
    const { id } = await params;
    const db = await getDatabase();

    const job = await db.getJob(id);
    if (!job) return errorResponse('Job not found', 404);

    await db.pauseJob(id);
    await db.setJobCooldownUntil(id, null);
    await db.setJobProgress(id, job.stage, job.current, job.total, 'Paused');

    return successResponse({ paused: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return errorResponse(msg, 500);
  }
}
