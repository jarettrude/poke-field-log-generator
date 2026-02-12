/**
 * Cancel a running or paused job. Emits a canceled SSE event for instant UI feedback.
 */

import { getDatabase } from '@/lib/db/adapter';
import { successResponse, errorResponse } from '@/lib/server/api';
import { jobEvents } from '@/lib/server/jobEvents';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = await getDatabase();

    const job = await db.getJob(id);
    if (!job) return errorResponse('Job not found', 404);

    await db.cancelJobAtomic(id, job.stage, job.current, job.total);

    jobEvents.emit(id, { type: 'canceled', jobId: id });

    return successResponse({ canceled: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return errorResponse(msg, 500);
  }
}
