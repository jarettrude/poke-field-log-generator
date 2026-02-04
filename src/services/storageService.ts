/**
 * Storage Service for Next.js app
 * Makes API calls to the backend instead of using IndexedDB
 */

const API_BASE = '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const result = (await response.json()) as ApiResponse<T>;
  
  // If explicitly failed or if data is missing when success is true (though data can be null for 404s logic below)
  if (!result.success) {
    throw new Error(result.error || 'Unknown API error');
  }
  
  // Cast data as T (it might be undefined if the API returns void success response, but T should match)
  return result.data as T;
}

/** Stored summary record returned by the backend API. */
export interface StoredSummary {
  id: number;
  name: string;
  summary: string;
  region: string;
  generationId: number;
  /** ISO timestamp string. */
  createdAt: string;
  /** ISO timestamp string. */
  updatedAt: string;
}

/** Input payload for creating/updating a summary. */
export interface SummaryInput {
  id: number;
  name: string;
  summary: string;
  region: string;
  generationId: number;
}

/** Stored audio log record returned by the backend API. */
export interface StoredAudioLog {
  id: number;
  name: string;
  region: string;
  generationId: number;
  voice: string;
  audioBase64: string;
  audioFormat: 'pcm_s16le' | 'wav';
  sampleRate: number;
  /** ISO timestamp string. */
  createdAt: string;
  /** ISO timestamp string. */
  updatedAt: string;
}

/** Input payload for creating/updating an audio log. */
export interface AudioLogInput {
  id: number;
  name: string;
  region: string;
  generationId: number;
  voice: string;
  audioBase64: string;
  audioFormat: 'pcm_s16le' | 'wav';
  sampleRate: number;
}

/**
 * Save a Pokémon summary.
 */
export const saveSummary = async (summary: SummaryInput): Promise<void> => {
  const response = await fetch(`${API_BASE}/summaries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(summary),
  });
  await handleResponse(response);
};

/**
 * Get a single summary by Pokémon id.
 */
export const getSummary = async (id: number): Promise<StoredSummary | null> => {
  const response = await fetch(`${API_BASE}/summaries/${id}`);
  
  // The standardized API returns success: false, error: 'Summary not found' with 404
  // We need to handle this specific case to return null as expected by the frontend
  const result = (await response.json()) as ApiResponse<StoredSummary>;
  
  if (!result.success) {
    if (response.status === 404) return null;
    throw new Error(result.error || 'Failed to fetch summary');
  }
  
  return result.data || null;
};

/**
 * Get all summaries for a generation.
 */
export const getSummariesByGeneration = async (generationId: number): Promise<StoredSummary[]> => {
  const response = await fetch(`${API_BASE}/summaries?generationId=${generationId}`);
  return handleResponse<StoredSummary[]>(response);
};

/**
 * Get all stored summaries.
 */
export const getAllSummaries = async (): Promise<StoredSummary[]> => {
  const response = await fetch(`${API_BASE}/summaries`);
  return handleResponse<StoredSummary[]>(response);
};

/**
 * Delete a summary by Pokémon id.
 */
export const deleteSummary = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE}/summaries/${id}`, {
    method: 'DELETE',
  });
  await handleResponse(response);
};

/**
 * Export all summaries as JSON.
 */
export const exportSummariesAsJSON = async (): Promise<string> => {
  const summaries = await getAllSummaries();
  return JSON.stringify(summaries, null, 2);
};

/**
 * Import summaries from JSON.
 */
export const importSummariesFromJSON = async (json: string): Promise<number> => {
  const summaries: StoredSummary[] = JSON.parse(json);
  let count = 0;

  for (const summary of summaries) {
    await saveSummary(summary);
    count++;
  }

  return count;
};

/**
 * Save an audio log.
 */
export const saveAudioLog = async (audioLog: AudioLogInput): Promise<void> => {
  const response = await fetch(`${API_BASE}/audio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(audioLog),
  });
  await handleResponse(response);
};

/**
 * Get a single audio log by Pokémon id.
 */
export const getAudioLog = async (id: number): Promise<StoredAudioLog | null> => {
  const response = await fetch(`${API_BASE}/audio/${id}`);
  
  const result = (await response.json()) as ApiResponse<StoredAudioLog>;
  
  if (!result.success) {
    if (response.status === 404) return null;
    throw new Error(result.error || 'Failed to fetch audio log');
  }
  
  return result.data || null;
};

/**
 * Get all audio logs for a generation.
 */
export const getAudioLogsByGeneration = async (generationId: number): Promise<StoredAudioLog[]> => {
  const response = await fetch(`${API_BASE}/audio?generationId=${generationId}`);
  return handleResponse<StoredAudioLog[]>(response);
};

/**
 * Get all stored audio logs.
 */
export const getAllAudioLogs = async (): Promise<StoredAudioLog[]> => {
  const response = await fetch(`${API_BASE}/audio`);
  return handleResponse<StoredAudioLog[]>(response);
};

/**
 * Delete an audio log by Pokémon id.
 */
export const deleteAudioLog = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE}/audio/${id}`, {
    method: 'DELETE',
  });
  await handleResponse(response);
};

/**
 * Delete multiple summaries by Pokémon ids.
 */
export const deleteSummaries = async (ids: number[]): Promise<void> => {
  const response = await fetch(`${API_BASE}/summaries`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  await handleResponse(response);
};

/**
 * Delete multiple audio logs by Pokémon ids.
 */
export const deleteAudioLogs = async (ids: number[]): Promise<void> => {
  const response = await fetch(`${API_BASE}/audio`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  await handleResponse(response);
};
