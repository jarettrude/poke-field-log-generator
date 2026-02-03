import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/adapter';
import { startJobRunner } from '@/lib/server/jobRunner';

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
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    await db.cancelJob(id);
    await db.setJobCooldownUntil(id, null);
    await db.setJobProgress(id, job.stage, job.current, job.total, 'Canceled');

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
