/**
 * Client-side job management service for creating and controlling processing jobs.
 */

const API_BASE = '/api/jobs';

export type ProcessingStage = 'summary' | 'audio';
export type JobStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'canceled';

export interface ProcessingJob {
  id: string;
  status: JobStatus;
  stage: ProcessingStage;
  mode: 'FULL' | 'SUMMARY_ONLY' | 'AUDIO_ONLY';
  generationId: number;
  region: string;
  voice: string;
  pokemonIds: number[];
  total: number;
  current: number;
  message: string;
  cooldownUntil: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create a new processing job and return its ID.
 */
export async function createJob(params: {
  mode: ProcessingJob['mode'];
  generationId: number;
  region: string;
  voice: string;
  pokemonIds: number[];
}): Promise<string> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || 'Failed to create job');
  }

  const data = (await response.json()) as { id: string };
  return data.id;
}

/**
 * Fetch the current state of a job by ID.
 */
export async function getJob(id: string): Promise<ProcessingJob> {
  const response = await fetch(`${API_BASE}/${id}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || 'Failed to fetch job');
  }
  return response.json();
}

/**
 * Pause a running job.
 */
export async function pauseJob(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}/pause`, { method: 'POST' });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || 'Failed to pause job');
  }
}

/**
 * Resume a paused job.
 */
export async function resumeJob(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}/resume`, { method: 'POST' });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || 'Failed to resume job');
  }
}

/**
 * Cancel a job.
 */
export async function cancelJob(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}/cancel`, { method: 'POST' });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || 'Failed to cancel job');
  }
}
