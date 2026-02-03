/**
 * SQLite Database Adapter
 * Uses better-sqlite3 for local persistent storage
 */

import Database from 'better-sqlite3';
import path from 'path';
import {
  DatabaseAdapter,
  ProcessingJob,
  CreateJobInput,
  JobStatus,
  ProcessingStage,
  StoredSummary,
  StoredAudioLog,
  CachedPokemon,
  SummaryInput,
  AudioLogInput,
  PokemonInput,
  StoredPrompt,
  PromptInput,
} from './adapter';

interface DatabaseRow {
  [key: string]: unknown;
}

export class SQLiteAdapter implements DatabaseAdapter {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    // Store in project root by default
    this.dbPath = dbPath || path.join(process.cwd(), 'pokemon_data.db');
  }

  async initialize(): Promise<void> {
    this.db = new Database(this.dbPath);

    // Enable WAL mode for better performance
    this.db.pragma('journal_mode = WAL');

    // Create summaries table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS summaries (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        summary TEXT NOT NULL,
        region TEXT NOT NULL,
        generation_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create audio logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audio_logs (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        region TEXT NOT NULL,
        generation_id INTEGER NOT NULL,
        voice TEXT NOT NULL,
        audio_base64 TEXT NOT NULL,
        audio_format TEXT NOT NULL,
        sample_rate INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create pokemon cache table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pokemon_cache (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        height INTEGER NOT NULL,
        weight INTEGER NOT NULL,
        types TEXT NOT NULL,
        habitat TEXT NOT NULL,
        flavor_texts TEXT NOT NULL,
        move_names TEXT NOT NULL,
        image_png_path TEXT,
        image_svg_path TEXT,
        cached_at TEXT NOT NULL
      )
    `);

    // Create prompts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS prompts (
        type TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create processing jobs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        stage TEXT NOT NULL,
        mode TEXT NOT NULL,
        generation_id INTEGER NOT NULL,
        region TEXT NOT NULL,
        voice TEXT NOT NULL,
        total INTEGER NOT NULL,
        current INTEGER NOT NULL,
        message TEXT NOT NULL,
        cooldown_until TEXT,
        error TEXT,
        pokemon_ids TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    const jobColumns = this.db
      .prepare("SELECT name FROM pragma_table_info('jobs')")
      .all() as Array<{ name: string }>;
    const hasCooldownUntil = jobColumns.some(c => c.name === 'cooldown_until');
    if (!hasCooldownUntil) {
      this.db.exec('ALTER TABLE jobs ADD COLUMN cooldown_until TEXT');
    }

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_summaries_generation ON summaries(generation_id)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audio_logs_generation ON audio_logs(generation_id)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at)
    `);

    console.log(`SQLite database initialized at: ${this.dbPath}`);
  }

  // Summary operations
  async saveSummary(summary: SummaryInput): Promise<void> {
    const now = new Date().toISOString();

    const stmt = this.db!.prepare(`
      INSERT OR REPLACE INTO summaries (id, name, summary, region, generation_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM summaries WHERE id = ?), ?), ?)
    `);

    stmt.run(
      summary.id,
      summary.name,
      summary.summary,
      summary.region,
      summary.generationId,
      summary.id,
      now,
      now
    );
  }

  async getSummary(id: number): Promise<StoredSummary | null> {
    const stmt = this.db!.prepare('SELECT * FROM summaries WHERE id = ?');
    const row = stmt.get(id) as DatabaseRow | undefined;

    if (!row) return null;

    return this.mapRowToSummary(row);
  }

  async getAllSummaries(): Promise<StoredSummary[]> {
    const stmt = this.db!.prepare('SELECT * FROM summaries ORDER BY id');
    const rows = stmt.all() as DatabaseRow[];

    return rows.map(this.mapRowToSummary);
  }

  async getSummariesByGeneration(genId: number): Promise<StoredSummary[]> {
    const stmt = this.db!.prepare('SELECT * FROM summaries WHERE generation_id = ? ORDER BY id');
    const rows = stmt.all(genId) as DatabaseRow[];

    return rows.map(this.mapRowToSummary);
  }

  async deleteSummary(id: number): Promise<void> {
    const stmt = this.db!.prepare('DELETE FROM summaries WHERE id = ?');
    stmt.run(id);
  }

  // Audio log operations
  async saveAudioLog(audioLog: AudioLogInput): Promise<void> {
    const now = new Date().toISOString();

    const stmt = this.db!.prepare(`
      INSERT OR REPLACE INTO audio_logs
      (id, name, region, generation_id, voice, audio_base64, audio_format, sample_rate, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM audio_logs WHERE id = ?), ?), ?)
    `);

    stmt.run(
      audioLog.id,
      audioLog.name,
      audioLog.region,
      audioLog.generationId,
      audioLog.voice,
      audioLog.audioBase64,
      audioLog.audioFormat,
      audioLog.sampleRate,
      audioLog.id,
      now,
      now
    );
  }

  async getAudioLog(id: number): Promise<StoredAudioLog | null> {
    const stmt = this.db!.prepare('SELECT * FROM audio_logs WHERE id = ?');
    const row = stmt.get(id) as DatabaseRow | undefined;

    if (!row) return null;

    return this.mapRowToAudioLog(row);
  }

  async getAllAudioLogs(): Promise<StoredAudioLog[]> {
    const stmt = this.db!.prepare('SELECT * FROM audio_logs ORDER BY id');
    const rows = stmt.all() as DatabaseRow[];
    return rows.map(this.mapRowToAudioLog);
  }

  async getAudioLogsByGeneration(genId: number): Promise<StoredAudioLog[]> {
    const stmt = this.db!.prepare('SELECT * FROM audio_logs WHERE generation_id = ? ORDER BY id');
    const rows = stmt.all(genId) as DatabaseRow[];
    return rows.map(this.mapRowToAudioLog);
  }

  async deleteAudioLog(id: number): Promise<void> {
    const stmt = this.db!.prepare('DELETE FROM audio_logs WHERE id = ?');
    stmt.run(id);
  }

  // Pokemon cache operations
  async cachePokemon(pokemon: PokemonInput): Promise<void> {
    const now = new Date().toISOString();

    const stmt = this.db!.prepare(`
      INSERT OR REPLACE INTO pokemon_cache 
      (id, name, height, weight, types, habitat, flavor_texts, move_names, image_png_path, image_svg_path, cached_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      pokemon.id,
      pokemon.name,
      pokemon.height,
      pokemon.weight,
      JSON.stringify(pokemon.types),
      pokemon.habitat,
      JSON.stringify(pokemon.flavorTexts),
      JSON.stringify(pokemon.moveNames),
      pokemon.imagePngPath,
      pokemon.imageSvgPath,
      now
    );
  }

  async getCachedPokemon(id: number): Promise<CachedPokemon | null> {
    const stmt = this.db!.prepare('SELECT * FROM pokemon_cache WHERE id = ?');
    const row = stmt.get(id) as DatabaseRow | undefined;

    if (!row) return null;

    return this.mapRowToPokemon(row);
  }

  async getAllCachedPokemon(): Promise<CachedPokemon[]> {
    const stmt = this.db!.prepare('SELECT * FROM pokemon_cache ORDER BY id');
    const rows = stmt.all() as DatabaseRow[];

    return rows.map(this.mapRowToPokemon);
  }

  // Prompt operations
  async savePrompt(prompt: PromptInput): Promise<void> {
    const now = new Date().toISOString();

    const stmt = this.db!.prepare(`
      INSERT OR REPLACE INTO prompts (type, content, created_at, updated_at)
      VALUES (?, ?, COALESCE((SELECT created_at FROM prompts WHERE type = ?), ?), ?)
    `);

    stmt.run(prompt.type, prompt.content, prompt.type, now, now);
  }

  async getPrompt(type: string): Promise<StoredPrompt | null> {
    const stmt = this.db!.prepare('SELECT * FROM prompts WHERE type = ?');
    const row = stmt.get(type) as DatabaseRow | undefined;

    if (!row) return null;

    return this.mapRowToPrompt(row);
  }

  async getAllPrompts(): Promise<StoredPrompt[]> {
    const stmt = this.db!.prepare('SELECT * FROM prompts ORDER BY type');
    const rows = stmt.all() as DatabaseRow[];

    return rows.map(this.mapRowToPrompt);
  }

  async deletePrompt(type: string): Promise<void> {
    const stmt = this.db!.prepare('DELETE FROM prompts WHERE type = ?');
    stmt.run(type);
  }

  // Job operations
  async createJob(input: CreateJobInput): Promise<void> {
    const now = new Date().toISOString();
    const initialStage: ProcessingStage = input.mode === 'AUDIO_ONLY' ? 'audio' : 'summary';
    const stmt = this.db!.prepare(`
      INSERT OR REPLACE INTO jobs
      (id, status, stage, mode, generation_id, region, voice, total, current, message, cooldown_until, error, pokemon_ids, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      input.id,
      'queued',
      initialStage,
      input.mode,
      input.generationId,
      input.region,
      input.voice,
      input.pokemonIds.length,
      0,
      'Queued',
      null,
      null,
      JSON.stringify(input.pokemonIds),
      now,
      now
    );
  }

  async getJob(id: string): Promise<ProcessingJob | null> {
    const stmt = this.db!.prepare('SELECT * FROM jobs WHERE id = ?');
    const row = stmt.get(id) as DatabaseRow | undefined;
    if (!row) return null;
    return this.mapRowToJob(row);
  }

  async claimNextQueuedJob(): Promise<{ job: ProcessingJob; pokemonIds: number[] } | null> {
    const now = new Date().toISOString();

    const claim = this.db!.transaction(() => {
      const stmt = this.db!.prepare(
        'SELECT * FROM jobs WHERE status = ? ORDER BY created_at ASC LIMIT 1'
      );
      const row = stmt.get('queued') as DatabaseRow | undefined;
      if (!row) return null;

      const update = this.db!.prepare(
        'UPDATE jobs SET status = ?, cooldown_until = NULL, updated_at = ? WHERE id = ?'
      );
      update.run('running', now, row.id);

      const refreshed = this.db!.prepare('SELECT * FROM jobs WHERE id = ?').get(row.id) as
        | DatabaseRow
        | undefined;
      if (!refreshed) return null;

      const job = this.mapRowToJob(refreshed);
      return { job, pokemonIds: job.pokemonIds };
    });

    return claim();
  }

  async setJobStatus(id: string, status: JobStatus): Promise<void> {
    const now = new Date().toISOString();
    const stmt = this.db!.prepare('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?');
    stmt.run(status, now, id);
  }

  async setJobProgress(
    id: string,
    stage: ProcessingStage,
    current: number,
    total: number,
    message: string
  ): Promise<void> {
    const now = new Date().toISOString();
    const stmt = this.db!.prepare(
      'UPDATE jobs SET stage = ?, current = ?, total = ?, message = ?, updated_at = ? WHERE id = ?'
    );
    stmt.run(stage, current, total, message, now, id);
  }

  async setJobCooldownUntil(id: string, cooldownUntil: string | null): Promise<void> {
    const now = new Date().toISOString();
    const stmt = this.db!.prepare(
      'UPDATE jobs SET cooldown_until = ?, updated_at = ? WHERE id = ?'
    );
    stmt.run(cooldownUntil, now, id);
  }

  async setJobError(id: string, error: string): Promise<void> {
    const now = new Date().toISOString();
    const stmt = this.db!.prepare(
      'UPDATE jobs SET status = ?, error = ?, updated_at = ? WHERE id = ?'
    );
    stmt.run('failed', error, now, id);
  }

  async cancelJob(id: string): Promise<void> {
    await this.setJobStatus(id, 'canceled');
  }

  async pauseJob(id: string): Promise<void> {
    await this.setJobStatus(id, 'paused');
  }

  async resumeJob(id: string): Promise<void> {
    await this.setJobStatus(id, 'queued');
  }

  // Helper methods
  private mapRowToSummary(row: DatabaseRow): StoredSummary {
    return {
      id: row.id as number,
      name: row.name as string,
      summary: row.summary as string,
      region: row.region as string,
      generationId: row.generation_id as number,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  private mapRowToPokemon(row: DatabaseRow): CachedPokemon {
    return {
      id: row.id as number,
      name: row.name as string,
      height: row.height as number,
      weight: row.weight as number,
      types: JSON.parse(row.types as string),
      habitat: row.habitat as string,
      flavorTexts: JSON.parse(row.flavor_texts as string),
      moveNames: JSON.parse(row.move_names as string),
      imagePngPath: row.image_png_path as string | null,
      imageSvgPath: row.image_svg_path as string | null,
      cachedAt: row.cached_at as string,
    };
  }

  private mapRowToAudioLog(row: DatabaseRow): StoredAudioLog {
    return {
      id: row.id as number,
      name: row.name as string,
      region: row.region as string,
      generationId: row.generation_id as number,
      voice: row.voice as string,
      audioBase64: row.audio_base64 as string,
      audioFormat: row.audio_format as StoredAudioLog['audioFormat'],
      sampleRate: row.sample_rate as number,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  private mapRowToPrompt(row: DatabaseRow): StoredPrompt {
    return {
      type: row.type as string,
      content: row.content as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  private mapRowToJob(row: DatabaseRow): ProcessingJob {
    const pokemonIds = JSON.parse((row.pokemon_ids as string) || '[]') as number[];
    return {
      id: row.id as string,
      status: row.status as ProcessingJob['status'],
      stage: row.stage as ProcessingJob['stage'],
      mode: row.mode as ProcessingJob['mode'],
      generationId: row.generation_id as number,
      region: row.region as string,
      voice: row.voice as string,
      pokemonIds,
      total: row.total as number,
      current: row.current as number,
      message: row.message as string,
      cooldownUntil: (row.cooldown_until as string | null) ?? null,
      error: (row.error as string | null) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
