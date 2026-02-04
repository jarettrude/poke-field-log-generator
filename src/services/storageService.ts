/**
 * Storage Service for Next.js app
 * Makes API calls to the backend instead of using IndexedDB
 */

const API_BASE = '/api';

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

  if (!response.ok) {
    throw new Error('Failed to save summary');
  }
};

/**
 * Get a single summary by Pokémon id.
 */
export const getSummary = async (id: number): Promise<StoredSummary | null> => {
  const response = await fetch(`${API_BASE}/summaries/${id}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Failed to fetch summary');
  }

  return response.json();
};

/**
 * Get all summaries for a generation.
 */
export const getSummariesByGeneration = async (generationId: number): Promise<StoredSummary[]> => {
  const response = await fetch(`${API_BASE}/summaries?generationId=${generationId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch summaries');
  }

  return response.json();
};

/**
 * Get all stored summaries.
 */
export const getAllSummaries = async (): Promise<StoredSummary[]> => {
  const response = await fetch(`${API_BASE}/summaries`);

  if (!response.ok) {
    throw new Error('Failed to fetch summaries');
  }

  return response.json();
};

/**
 * Delete a summary by Pokémon id.
 */
export const deleteSummary = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE}/summaries/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete summary');
  }
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

  if (!response.ok) {
    throw new Error('Failed to save audio log');
  }
};

/**
 * Get a single audio log by Pokémon id.
 */
export const getAudioLog = async (id: number): Promise<StoredAudioLog | null> => {
  const response = await fetch(`${API_BASE}/audio/${id}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Failed to fetch audio log');
  }

  return response.json();
};

/**
 * Get all audio logs for a generation.
 */
export const getAudioLogsByGeneration = async (generationId: number): Promise<StoredAudioLog[]> => {
  const response = await fetch(`${API_BASE}/audio?generationId=${generationId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch audio logs');
  }

  return response.json();
};

/**
 * Get all stored audio logs.
 */
export const getAllAudioLogs = async (): Promise<StoredAudioLog[]> => {
  const response = await fetch(`${API_BASE}/audio`);

  if (!response.ok) {
    throw new Error('Failed to fetch audio logs');
  }

  return response.json();
};

/**
 * Delete an audio log by Pokémon id.
 */
export const deleteAudioLog = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE}/audio/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete audio log');
  }
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

  if (!response.ok) {
    throw new Error('Failed to delete summaries');
  }
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

  if (!response.ok) {
    throw new Error('Failed to delete audio logs');
  }
};
