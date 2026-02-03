/**
 * MySQL Database Adapter (Placeholder)
 * Implement when ready to switch to MySQL
 */

import {
  DatabaseAdapter,
  StoredSummary,
  CachedPokemon,
  SummaryInput,
  PokemonInput,
  StoredAudioLog,
  AudioLogInput,
  StoredPrompt,
  PromptInput,
  CreateJobInput,
  ProcessingJob,
  JobStatus,
  ProcessingStage,
} from './adapter';

export class MySQLAdapter implements DatabaseAdapter {
  async initialize(): Promise<void> {
    // TODO: Connect to MySQL using environment variables
    // MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
    throw new Error('MySQL adapter not yet implemented. Use SQLite for now.');
  }

  async saveSummary(_summary: SummaryInput): Promise<void> {
    throw new Error('Not implemented');
  }

  async getSummary(_id: number): Promise<StoredSummary | null> {
    throw new Error('Not implemented');
  }

  async getAllSummaries(): Promise<StoredSummary[]> {
    throw new Error('Not implemented');
  }

  async getSummariesByGeneration(_genId: number): Promise<StoredSummary[]> {
    throw new Error('Not implemented');
  }

  async deleteSummary(_id: number): Promise<void> {
    throw new Error('Not implemented');
  }

  async saveAudioLog(_audioLog: AudioLogInput): Promise<void> {
    throw new Error('Not implemented');
  }

  async getAudioLog(_id: number): Promise<StoredAudioLog | null> {
    throw new Error('Not implemented');
  }

  async getAllAudioLogs(): Promise<StoredAudioLog[]> {
    throw new Error('Not implemented');
  }

  async getAudioLogsByGeneration(_genId: number): Promise<StoredAudioLog[]> {
    throw new Error('Not implemented');
  }

  async deleteAudioLog(_id: number): Promise<void> {
    throw new Error('Not implemented');
  }

  async cachePokemon(_pokemon: PokemonInput): Promise<void> {
    throw new Error('Not implemented');
  }

  async getCachedPokemon(_id: number): Promise<CachedPokemon | null> {
    throw new Error('Not implemented');
  }

  async getAllCachedPokemon(): Promise<CachedPokemon[]> {
    throw new Error('Not implemented');
  }

  // Prompt operations
  async savePrompt(_prompt: PromptInput): Promise<void> {
    throw new Error('Not implemented');
  }

  async getPrompt(_type: string): Promise<StoredPrompt | null> {
    throw new Error('Not implemented');
  }

  async getAllPrompts(): Promise<StoredPrompt[]> {
    throw new Error('Not implemented');
  }

  async deletePrompt(_type: string): Promise<void> {
    throw new Error('Not implemented');
  }

  // Job operations
  async createJob(_input: CreateJobInput): Promise<void> {
    throw new Error('Not implemented');
  }

  async getJob(_id: string): Promise<ProcessingJob | null> {
    throw new Error('Not implemented');
  }

  async claimNextQueuedJob(): Promise<{ job: ProcessingJob; pokemonIds: number[] } | null> {
    throw new Error('Not implemented');
  }

  async setJobStatus(_id: string, _status: JobStatus): Promise<void> {
    throw new Error('Not implemented');
  }

  async setJobProgress(
    _id: string,
    _stage: ProcessingStage,
    _current: number,
    _total: number,
    _message: string
  ): Promise<void> {
    throw new Error('Not implemented');
  }

  async setJobCooldownUntil(_id: string, _cooldownUntil: string | null): Promise<void> {
    throw new Error('Not implemented');
  }

  async setJobError(_id: string, _error: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async cancelJob(_id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async pauseJob(_id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async resumeJob(_id: string): Promise<void> {
    throw new Error('Not implemented');
  }
}
