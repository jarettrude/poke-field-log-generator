/**
 * Server-side event emitter for real-time job progress updates via SSE.
 *
 * Uses a globalThis-based singleton so the jobRunner (which emits events)
 * and the SSE endpoint (which subscribes) share the same instance across
 * Next.js module re-evaluations and HMR.
 *
 * Event types:
 *   - progress: Job progress update (stage, current, total, message, cooldown)
 *   - completed: Job finished successfully
 *   - failed: Job failed with error message
 *   - canceled: Job was canceled by user
 *   - paused: Job was paused
 *   - resumed: Job was resumed (re-queued)
 */

export interface JobProgressEvent {
  type: 'progress';
  jobId: string;
  status: string;
  stage: 'summary' | 'audio';
  current: number;
  total: number;
  message: string;
  cooldownUntil: string | null;
}

export interface JobCompletedEvent {
  type: 'completed';
  jobId: string;
  generationId: number;
  pokemonIds: number[];
  mode: 'FULL' | 'SUMMARY_ONLY' | 'AUDIO_ONLY';
}

export interface JobFailedEvent {
  type: 'failed';
  jobId: string;
  error: string;
  generationId: number;
  pokemonIds: number[];
  mode: 'FULL' | 'SUMMARY_ONLY' | 'AUDIO_ONLY';
}

export interface JobCanceledEvent {
  type: 'canceled';
  jobId: string;
}

export interface JobPausedEvent {
  type: 'paused';
  jobId: string;
}

export interface JobResumedEvent {
  type: 'resumed';
  jobId: string;
}

export type JobEvent =
  | JobProgressEvent
  | JobCompletedEvent
  | JobFailedEvent
  | JobCanceledEvent
  | JobPausedEvent
  | JobResumedEvent;

type JobEventListener = (event: JobEvent) => void;

class JobEventEmitter {
  private listeners = new Map<string, Set<JobEventListener>>();

  /**
   * Subscribe to events for a specific job.
   * Returns an unsubscribe function.
   */
  subscribe(jobId: string, listener: JobEventListener): () => void {
    if (!this.listeners.has(jobId)) {
      this.listeners.set(jobId, new Set());
    }
    this.listeners.get(jobId)!.add(listener);

    return () => {
      const set = this.listeners.get(jobId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(jobId);
        }
      }
    };
  }

  /**
   * Emit an event to all listeners subscribed to the given job.
   */
  emit(jobId: string, event: JobEvent): void {
    const set = this.listeners.get(jobId);
    if (set) {
      for (const listener of set) {
        try {
          listener(event);
        } catch (e) {
          console.error('JobEventEmitter listener error:', e);
        }
      }
    }
  }
}

// Singleton via globalThis
const globalEvents = globalThis as unknown as {
  __jobEventEmitter?: JobEventEmitter;
};

if (!globalEvents.__jobEventEmitter) {
  globalEvents.__jobEventEmitter = new JobEventEmitter();
}

export const jobEvents = globalEvents.__jobEventEmitter;
