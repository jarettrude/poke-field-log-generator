import { ProcessingJob as DBProcessingJob } from '@/lib/db/adapter';

const API_BASE = '/api/jobs';

export type ProcessingStage = 'summary' | 'audio';
export type JobStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'canceled';

// Re-export the type from the DB adapter to ensure consistency
export type ProcessingJob = DBProcessingJob;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const result = (await response.json()) as ApiResponse<T>;

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Unknown API error');
  }

  return result.data;
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

  const data = await handleResponse<{ id: string }>(response);
  return data.id;
}

/**
 * Fetch the current state of a job by ID.
 */
export async function getJob(id: string): Promise<ProcessingJob> {
  const response = await fetch(`${API_BASE}/${id}`);
  return handleResponse<ProcessingJob>(response);
}

/**
 * Pause a running job.
 */
export async function pauseJob(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}/pause`, { method: 'POST' });
  await handleResponse(response);
}

/**
 * Resume a paused job.
 */
export async function resumeJob(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}/resume`, { method: 'POST' });
  await handleResponse(response);
}

/**
 * Cancel a job.
 */
export async function cancelJob(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}/cancel`, { method: 'POST' });
  await handleResponse(response);
}
