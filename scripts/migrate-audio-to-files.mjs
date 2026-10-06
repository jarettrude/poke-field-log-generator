#!/usr/bin/env node
/**
 * One-time host-side migration: extract base64 MP3 blobs from audio_logs into
 * files under data/audio/, swap the column for audio_path, and VACUUM.
 *
 * Run with the app stopped:
 *   node scripts/migrate-audio-to-files.mjs
 *
 * Resumable: extracted rows are marked via audio_path; re-running continues
 * where an interrupted run left off. Mirrors the logic in
 * src/lib/db/sqlite.ts (migrateAudioBlobsToFiles) so the app-side migration
 * no-ops on an already-migrated database.
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const dbPath = path.join(process.cwd(), 'data', 'pokemon_data.db');
const audioDir = path.join(path.dirname(dbPath), 'audio');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 120000');

const columnNames = () =>
  new Set(
    db
      .prepare("SELECT name FROM pragma_table_info('audio_logs')")
      .all()
      .map(c => c.name)
  );

if (!columnNames().has('audio_base64')) {
  console.log('audio_logs already uses audio_path; nothing to migrate.');
  process.exit(0);
}

fs.mkdirSync(audioDir, { recursive: true });

if (!columnNames().has('audio_path')) {
  db.exec('ALTER TABLE audio_logs ADD COLUMN audio_path TEXT');
}

const select = db.prepare(
  'SELECT id, audio_base64 FROM audio_logs WHERE audio_path IS NULL ORDER BY id'
);
const extractedIds = [];
let count = 0;
for (const row of select.iterate()) {
  fs.writeFileSync(path.join(audioDir, `${row.id}.mp3`), Buffer.from(row.audio_base64, 'base64'));
  extractedIds.push(row.id);
  if (++count % 250 === 0) console.log(`extracted ${count} files...`);
}
console.log(`extracted ${count} files total`);

db.exec('BEGIN IMMEDIATE');
const update = db.prepare('UPDATE audio_logs SET audio_path = ? WHERE id = ?');
for (const id of extractedIds) {
  update.run(`audio/${id}.mp3`, id);
}
db.exec(`
  CREATE TABLE audio_logs_new (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    region TEXT NOT NULL,
    generation_id INTEGER NOT NULL,
    voice TEXT NOT NULL,
    audio_path TEXT NOT NULL,
    audio_format TEXT NOT NULL,
    bitrate INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);
db.exec(`
  INSERT INTO audio_logs_new (id, name, region, generation_id, voice, audio_path, audio_format, bitrate, created_at, updated_at)
  SELECT id, name, region, generation_id, voice, audio_path, audio_format, bitrate, created_at, updated_at FROM audio_logs
`);
db.exec('DROP TABLE audio_logs');
db.exec('ALTER TABLE audio_logs_new RENAME TO audio_logs');
db.exec('CREATE INDEX IF NOT EXISTS idx_audio_logs_generation ON audio_logs(generation_id)');
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_audio_logs_metadata
  ON audio_logs (id, name, region, generation_id, voice, audio_format, bitrate, created_at, updated_at)
`);
db.exec('COMMIT');
console.log(`marked ${extractedIds.length} rows, rebuilt table`);

console.log('vacuuming (reclaims freed blob pages)...');
db.exec('VACUUM');
db.close();
console.log('done');
