/**
 * Background job runner that processes queued summary and TTS generation jobs.
 *
 * The runner polls the database for queued jobs, claims them atomically, and
 * processes them through summary generation and/or audio synthesis stages.
 * Supports pause/resume/cancel controls and enforces cooldowns between API calls.
 */

import { getDatabase } from '@/lib/db/adapter';
import type { ProcessingJob, ProcessingStage } from '@/lib/db/adapter';
import { splitAudioBySilenceNode } from '@/services/audioSplitterNode';
import { generateSummary, generateTts, combineSummariesForTts } from './gemini';
import {
  SERVER_SUMMARY_COOLDOWN_MS,
  SERVER_TTS_BATCH_SIZE,
  SERVER_TTS_COOLDOWN_MS,
  SERVER_TTS_AUDIO_FORMAT,
  SERVER_TTS_SAMPLE_RATE,
} from './config';
import { getOrFetchPokemonDetailsServer } from './pokemon';

let runnerStarted = false;
let isTicking = false;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sleepWithJobControl(
  jobId: string,
  durationMs: number
): Promise<'ok' | 'paused' | 'canceled'> {
  const db = await getDatabase();
  const start = Date.now();
  while (Date.now() - start < durationMs) {
    const job = await db.getJob(jobId);
    if (!job) return 'canceled';
    if (job.status === 'canceled' || job.status === 'failed') return 'canceled';
    if (job.status === 'paused') return 'paused';
    await sleep(1000);
  }
  return 'ok';
}

async function setProgress(params: {
  jobId: string;
  stage: ProcessingStage;
  current: number;
  total: number;
  message: string;
}): Promise<void> {
  const db = await getDatabase();
  await db.setJobProgress(params.jobId, params.stage, params.current, params.total, params.message);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function processSummaryStage(job: ProcessingJob): Promise<'ok' | 'paused' | 'canceled'> {
  const db = await getDatabase();
  const total = job.pokemonIds.length;
  const startIndex = Math.max(0, job.current);

  await setProgress({
    jobId: job.id,
    stage: 'summary',
    current: startIndex,
    total,
    message: 'Starting summary generation...',
  });

  for (let idx = startIndex; idx < job.pokemonIds.length; idx++) {
    const latest = await db.getJob(job.id);
    if (!latest) return 'canceled';
    if (latest.status === 'paused') return 'paused';
    if (latest.status === 'canceled') return 'canceled';

    const pokemonId = job.pokemonIds[idx];
    if (pokemonId === undefined) continue;

    await setProgress({
      jobId: job.id,
      stage: 'summary',
      current: idx,
      total,
      message: `Generating summary for #${pokemonId}...`,
    });

    const details = await getOrFetchPokemonDetailsServer(pokemonId);
    const summary = await generateSummary(details, job.region);

    await db.saveSummary({
      id: details.id,
      name: details.name,
      summary,
      region: job.region,
      generationId: job.generationId,
    });

    await setProgress({
      jobId: job.id,
      stage: 'summary',
      current: idx + 1,
      total,
      message: `Saved summary for #${pokemonId}.`,
    });

    if (idx < job.pokemonIds.length - 1) {
      const cooldownUntil = new Date(Date.now() + SERVER_SUMMARY_COOLDOWN_MS).toISOString();
      await db.setJobCooldownUntil(job.id, cooldownUntil);
      const result = await sleepWithJobControl(job.id, SERVER_SUMMARY_COOLDOWN_MS);
      await db.setJobCooldownUntil(job.id, null);
      if (result !== 'ok') return result;
    }
  }

  return 'ok';
}

async function processAudioStage(job: ProcessingJob): Promise<'ok' | 'paused' | 'canceled'> {
  const db = await getDatabase();

  const summaries = [] as Array<{
    id: number;
    name: string;
    summary: string;
    region: string;
    generationId: number;
  }>;
  for (const pokemonId of job.pokemonIds) {
    const s = await db.getSummary(pokemonId);
    if (!s) {
      throw new Error(`Missing saved summary for #${pokemonId}. Generate summaries first.`);
    }
    summaries.push({
      id: s.id,
      name: s.name,
      summary: s.summary,
      region: s.region,
      generationId: s.generationId,
    });
  }

  const batches = chunkArray(summaries, SERVER_TTS_BATCH_SIZE);
  const totalBatches = batches.length;
  const startBatchIndex = Math.max(0, job.current);

  await setProgress({
    jobId: job.id,
    stage: 'audio',
    current: startBatchIndex,
    total: totalBatches,
    message: 'Starting audio synthesis...',
  });

  for (let batchIdx = startBatchIndex; batchIdx < batches.length; batchIdx++) {
    const latest = await db.getJob(job.id);
    if (!latest) return 'canceled';
    if (latest.status === 'paused') return 'paused';
    if (latest.status === 'canceled') return 'canceled';

    const batch = batches[batchIdx];
    if (!batch || batch.length === 0) continue;

    await setProgress({
      jobId: job.id,
      stage: 'audio',
      current: batchIdx,
      total: totalBatches,
      message: `Synthesizing batch ${batchIdx + 1}/${totalBatches}...`,
    });

    const combinedText = combineSummariesForTts(
      batch.map(s => ({ id: s.id, name: s.name, text: s.summary }))
    );
    const audioData = await generateTts({ text: combinedText, voiceName: job.voice, isBulk: true });

    await setProgress({
      jobId: job.id,
      stage: 'audio',
      current: batchIdx,
      total: totalBatches,
      message: `Splitting batch ${batchIdx + 1}/${totalBatches}...`,
    });

    const split = splitAudioBySilenceNode(audioData, batch.length, SERVER_TTS_SAMPLE_RATE);

    for (let j = 0; j < batch.length; j++) {
      const summary = batch[j];
      if (!summary) continue;
      const segment = split.segments[j] || audioData;

      await db.saveAudioLog({
        id: summary.id,
        name: summary.name,
        region: summary.region,
        generationId: summary.generationId,
        voice: job.voice,
        audioBase64: segment,
        audioFormat: SERVER_TTS_AUDIO_FORMAT,
        sampleRate: SERVER_TTS_SAMPLE_RATE,
      });
    }

    await setProgress({
      jobId: job.id,
      stage: 'audio',
      current: batchIdx + 1,
      total: totalBatches,
      message: `Saved audio logs for batch ${batchIdx + 1}/${totalBatches}.`,
    });

    if (batchIdx < batches.length - 1) {
      const cooldownUntil = new Date(Date.now() + SERVER_TTS_COOLDOWN_MS).toISOString();
      await db.setJobCooldownUntil(job.id, cooldownUntil);
      const result = await sleepWithJobControl(job.id, SERVER_TTS_COOLDOWN_MS);
      await db.setJobCooldownUntil(job.id, null);
      if (result !== 'ok') return result;
    }
  }

  return 'ok';
}

async function processJob(job: ProcessingJob): Promise<void> {
  const db = await getDatabase();

  try {
    const fresh = await db.getJob(job.id);
    if (!fresh) return;
    if (fresh.status === 'canceled') return;

    if (fresh.stage === 'summary') {
      const result = await processSummaryStage(fresh);
      if (result !== 'ok') return;

      if (fresh.mode === 'SUMMARY_ONLY') {
        await db.setJobCooldownUntil(fresh.id, null);
        await db.setJobStatus(fresh.id, 'completed');
        await setProgress({
          jobId: fresh.id,
          stage: 'summary',
          current: fresh.pokemonIds.length,
          total: fresh.pokemonIds.length,
          message: 'Completed summary generation.',
        });
        return;
      }

      await setProgress({
        jobId: fresh.id,
        stage: 'audio',
        current: 0,
        total: 0,
        message: 'Preparing audio synthesis...',
      });

      const now = await db.getJob(fresh.id);
      if (!now) return;
      now.stage = 'audio';
      now.current = 0;
      await db.setJobProgress(fresh.id, 'audio', 0, 0, 'Preparing audio synthesis...');
      await db.setJobCooldownUntil(fresh.id, null);

      const audioResult = await processAudioStage(now);
      if (audioResult !== 'ok') return;

      await db.setJobCooldownUntil(now.id, null);
      await db.setJobStatus(now.id, 'completed');
      await setProgress({
        jobId: now.id,
        stage: 'audio',
        current: now.total,
        total: now.total,
        message: 'Completed audio synthesis.',
      });
      return;
    }

    if (fresh.stage === 'audio') {
      const audioResult = await processAudioStage(fresh);
      if (audioResult !== 'ok') return;

      await db.setJobCooldownUntil(fresh.id, null);
      await db.setJobStatus(fresh.id, 'completed');
      await setProgress({
        jobId: fresh.id,
        stage: 'audio',
        current: fresh.total,
        total: fresh.total,
        message: 'Completed audio synthesis.',
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.setJobError(job.id, msg);
    await db.setJobCooldownUntil(job.id, null);
  }
}

async function tick(): Promise<void> {
  if (isTicking) return;
  isTicking = true;

  try {
    const db = await getDatabase();
    const claimed = await db.claimNextQueuedJob();
    if (!claimed) return;
    await processJob(claimed.job);
  } finally {
    isTicking = false;
  }
}

export function startJobRunner(): void {
  if (runnerStarted) return;
  runnerStarted = true;

  setInterval(() => {
    void tick();
  }, 1000);

  void tick();
}
