/**
 * Database Adapter Interface
 * Provides abstraction for different database backends (SQLite, MySQL)
 */

export interface StoredSummary {
  id: number;
  name: string;
  summary: string;
  region: string;
  generationId: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoredAudioLog {
  id: number;
  name: string;
  region: string;
  generationId: number;
  voice: string;
  audioBase64: string;
  audioFormat: 'mp3';
  bitrate: number;
  createdAt: string;
  updatedAt: string;
}

// Metadata-only version (excludes large audioBase64 field for list endpoints)
export type AudioLogMetadata = Omit<StoredAudioLog, 'audioBase64'>;

export interface CachedPokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: string[];
  habitat: string;
  flavorTexts: string[];
  moveNames: string[];
  imagePngPath: string | null;
  imageSvgPath: string | null;
  generationId: number;
  region: string;
  cachedAt: string;
}

export interface SummaryInput {
  id: number;
  name: string;
  summary: string;
  region: string;
  generationId: number;
}

export interface AudioLogInput {
  id: number;
  name: string;
  region: string;
  generationId: number;
  voice: string;
  audioBase64: string;
  audioFormat: 'mp3';
  bitrate: number;
}

export interface PokemonInput {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: string[];
  habitat: string;
  flavorTexts: string[];
  moveNames: string[];
  imagePngPath: string | null;
  imageSvgPath: string | null;
  generationId: number;
  region: string;
}

export interface StoredPrompt {
  type: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

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
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobInput {
  id: string;
  mode: ProcessingJob['mode'];
  generationId: number;
  region: string;
  voice: string;
  pokemonIds: number[];
}

export interface PromptInput {
  type: string;
  content: string;
}

export interface DatabaseAdapter {
  // Summary operations
  saveSummary(summary: SummaryInput): Promise<void>;
  getSummary(id: number): Promise<StoredSummary | null>;
  getAllSummaries(): Promise<StoredSummary[]>;
  getSummariesByGeneration(genId: number): Promise<StoredSummary[]>;
  deleteSummary(id: number): Promise<void>;

  // Audio log operations
  saveAudioLog(audioLog: AudioLogInput): Promise<void>;
  getAudioLog(id: number): Promise<StoredAudioLog | null>;
  getAllAudioLogs(): Promise<StoredAudioLog[]>;
  getAllAudioLogsMetadata(): Promise<AudioLogMetadata[]>;
  getAudioLogsByGeneration(genId: number): Promise<StoredAudioLog[]>;
  getAudioLogsMetadataByGeneration(genId: number): Promise<AudioLogMetadata[]>;
  deleteAudioLog(id: number): Promise<void>;

  // Pokemon cache operations
  cachePokemon(pokemon: PokemonInput): Promise<void>;
  getCachedPokemon(id: number): Promise<CachedPokemon | null>;
  getAllCachedPokemon(): Promise<CachedPokemon[]>;

  // Prompt operations
  savePrompt(prompt: PromptInput): Promise<void>;
  getPrompt(type: string): Promise<StoredPrompt | null>;
  getAllPrompts(): Promise<StoredPrompt[]>;
  deletePrompt(type: string): Promise<void>;

  // Job operations
  createJob(input: CreateJobInput): Promise<void>;
  getJob(id: string): Promise<ProcessingJob | null>;
  claimNextQueuedJob(): Promise<{ job: ProcessingJob; pokemonIds: number[] } | null>;
  getAllRunningJobs(): Promise<ProcessingJob[]>;
  setJobStatus(id: string, status: JobStatus): Promise<void>;
  setJobProgress(
    id: string,
    stage: ProcessingStage,
    current: number,
    total: number,
    message: string
  ): Promise<void>;
  setJobCooldownUntil(id: string, cooldownUntil: string | null): Promise<void>;
  setJobError(id: string, error: string): Promise<void>;
  incrementJobRetry(id: string): Promise<void>;
  cancelJob(id: string): Promise<void>;
  pauseJob(id: string): Promise<void>;
  resumeJob(id: string): Promise<void>;
  recoverStalledJobs(stalledThresholdMs: number): Promise<number>;

  // Initialization
  initialize(): Promise<void>;
}

// Factory function to get the appropriate database adapter
export async function getDatabaseAdapter(): Promise<DatabaseAdapter> {
  const dbType = process.env.DB_TYPE || 'sqlite';

  if (dbType === 'mysql') {
    const { MySQLAdapter } = await import('./mysql');
    return new MySQLAdapter();
  }

  const { SQLiteAdapter } = await import('./sqlite');
  return new SQLiteAdapter();
}

// Singleton instance
let dbInstance: DatabaseAdapter | null = null;
let dbInitPromise: Promise<DatabaseAdapter> | null = null;

export async function getDatabase(): Promise<DatabaseAdapter> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const adapter = await getDatabaseAdapter();
      await adapter.initialize();
      dbInstance = adapter;
      return adapter;
    })();
  }

  return dbInitPromise;
}
