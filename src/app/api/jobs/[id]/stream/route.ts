/**
 * SSE endpoint for real-time job progress streaming.
 *
 * The client opens an EventSource connection to /api/jobs/:id/stream.
 * The server subscribes to the jobEvents emitter and pushes events
 * as they happen — no polling, no heartbeat DB writes.
 *
 * On connect, we send the current job state as an initial event so
 * the client doesn't miss anything if it connects mid-job.
 */

import { getDatabase } from '@/lib/db/adapter';
import { jobEvents } from '@/lib/server/jobEvents';
import type { JobEvent } from '@/lib/server/jobEvents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id: jobId } = await params;

  const db = await getDatabase();
  const job = await db.getJob(jobId);

  if (!job) {
    return new Response(JSON.stringify({ success: false, error: 'Job not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  function cleanup() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
  }

  const stream = new ReadableStream({
    start(controller) {
      function send(event: JobEvent) {
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          cleanup();
        }
      }

      function sendAndClose(event: JobEvent) {
        send(event);
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }

      if (job.status === 'completed') {
        sendAndClose({
          type: 'completed',
          jobId: job.id,
          generationId: job.generationId,
          pokemonIds: job.pokemonIds,
          mode: job.mode,
        });
        return;
      }

      if (job.status === 'failed') {
        sendAndClose({
          type: 'failed',
          jobId: job.id,
          error: job.error || 'Unknown error',
          generationId: job.generationId,
          pokemonIds: job.pokemonIds,
          mode: job.mode,
        });
        return;
      }

      if (job.status === 'canceled') {
        sendAndClose({ type: 'canceled', jobId: job.id });
        return;
      }

      send({
        type: 'progress',
        jobId: job.id,
        status: job.status,
        stage: job.stage,
        current: job.current,
        total: job.total,
        message: job.message,
        cooldownUntil: job.cooldownUntil,
      });

      if (job.status === 'paused') {
        send({ type: 'paused', jobId: job.id });
      }

      unsubscribe = jobEvents.subscribe(jobId, event => {
        if (event.type === 'completed' || event.type === 'failed' || event.type === 'canceled') {
          sendAndClose(event);
        } else {
          send(event);
        }
      });

      keepAliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          cleanup();
        }
      }, 30000);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
