import { getDatabase } from '@/lib/db/adapter';
import { successResponse, errorResponse } from '@/lib/server/api';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const db = await getDatabase();
    const running = await db.getAllRunningJobs();

    for (const job of running) {
      await db.pauseJob(job.id);
      await db.setJobCooldownUntil(job.id, null);
      await db.setJobProgress(job.id, job.stage, job.current, job.total, 'Paused');
    }

    return successResponse({ pausedCount: running.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return errorResponse(msg, 500);
  }
}
