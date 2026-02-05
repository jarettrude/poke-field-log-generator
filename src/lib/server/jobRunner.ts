/**
 * Background job runner that processes queued summary and TTS generation jobs.
 *
 * The runner polls the database for queued jobs, claims them atomically, and
 * processes them through summary generation and/or audio synthesis stages.
 * Supports pause/resume/cancel controls and enforces cooldowns between API calls.
 */

import { getDatabase } from '@/lib/db/adapter';
import type { ProcessingJob, ProcessingStage } from '@/lib/db/adapter';
import { generateSummary, generateTts } from './gemini';
import {
  jitteredCooldown,
  SERVER_SUMMARY_COOLDOWN_MS,
  SERVER_TTS_AUDIO_FORMAT,
  SERVER_TTS_COOLDOWN_MS,
  SERVER_TTS_SAMPLE_RATE,
  SERVER_TTS_MP3_BITRATE,
} from './config';
import { convertPcmToMp3 } from './audioConverter';
import { getOrFetchPokemonDetailsServer } from './pokemon';

let runnerStarted = false;
const activeJobs = new Map<string, Promise<void>>();
const MAX_CONCURRENT_TEXT_JOBS = 3;
const MAX_CONCURRENT_AUDIO_JOBS = 1;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 5000;

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

type SummaryItem = {
  id: number;
  name: string;
  summary: string;
  region: string;
  generationId: number;
};

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

    let retryCount = 0;
    let success = false;

    while (!success && retryCount < MAX_RETRIES) {
      try {
        const details = await getOrFetchPokemonDetailsServer(pokemonId);
        const summary = await generateSummary(details, details.region);

        await db.saveSummary({
          id: details.id,
          name: details.name,
          summary,
          region: details.region,
          generationId: details.generationId,
        });

        success = true;
      } catch (error) {
        retryCount++;

        if (retryCount >= MAX_RETRIES) {
          throw error;
        }

        const backoffMs = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount - 1);
        await setProgress({
          jobId: job.id,
          stage: 'summary',
          current: idx,
          total,
          message: `Error on #${pokemonId}, retrying in ${Math.round(backoffMs / 1000)}s... (${retryCount}/${MAX_RETRIES})`,
        });

        await db.incrementJobRetry(job.id);
        const result = await sleepWithJobControl(job.id, backoffMs);
        if (result !== 'ok') return result;
      }
    }

    await setProgress({
      jobId: job.id,
      stage: 'summary',
      current: idx + 1,
      total,
      message: `Saved summary for #${pokemonId}.`,
    });

    if (idx < job.pokemonIds.length - 1) {
      const cooldownMs = jitteredCooldown(SERVER_SUMMARY_COOLDOWN_MS);
      const cooldownUntil = new Date(Date.now() + cooldownMs).toISOString();
      await db.setJobCooldownUntil(job.id, cooldownUntil);
      const result = await sleepWithJobControl(job.id, cooldownMs);
      await db.setJobCooldownUntil(job.id, null);
      if (result !== 'ok') return result;
    }
  }

  return 'ok';
}

/**
 * Process audio stage: one TTS call per Pokémon.
 *
 * Batching was removed because Gemini TTS model truncates/ignores
 * most of the input when given combined text with multiple entries.
 */
async function processAudioStage(job: ProcessingJob): Promise<'ok' | 'paused' | 'canceled'> {
  const db = await getDatabase();

  const summaries: SummaryItem[] = [];
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

  const total = summaries.length;
  const startIndex = Math.max(0, job.current);

  await setProgress({
    jobId: job.id,
    stage: 'audio',
    current: startIndex,
    total,
    message: 'Starting audio synthesis...',
  });

  for (let idx = startIndex; idx < summaries.length; idx++) {
    const latest = await db.getJob(job.id);
    if (!latest) return 'canceled';
    if (latest.status === 'paused') return 'paused';
    if (latest.status === 'canceled') return 'canceled';

    const summary = summaries[idx];
    if (!summary) continue;

    await setProgress({
      jobId: job.id,
      stage: 'audio',
      current: idx,
      total,
      message: `Synthesizing audio for #${summary.id} ${summary.name}...`,
    });

    let audioData = '';
    let retryCount = 0;
    let success = false;

    while (!success && retryCount < MAX_RETRIES) {
      try {
        audioData = await generateTts({
          text: summary.summary,
          voiceName: job.voice,
        });
        success = true;
      } catch (error) {
        retryCount++;

        if (retryCount >= MAX_RETRIES) {
          throw error;
        }

        const backoffMs = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount - 1);
        await setProgress({
          jobId: job.id,
          stage: 'audio',
          current: idx,
          total,
          message: `TTS error on #${summary.id}, retrying in ${Math.round(backoffMs / 1000)}s... (${retryCount}/${MAX_RETRIES})`,
        });

        await db.incrementJobRetry(job.id);
        const result = await sleepWithJobControl(job.id, backoffMs);
        if (result !== 'ok') return result;
      }
    }

    const mp3Data = await convertPcmToMp3(
      audioData,
      SERVER_TTS_SAMPLE_RATE,
      SERVER_TTS_MP3_BITRATE
    );

    await db.saveAudioLog({
      id: summary.id,
      name: summary.name,
      region: summary.region,
      generationId: summary.generationId,
      voice: job.voice,
      audioBase64: mp3Data,
      audioFormat: SERVER_TTS_AUDIO_FORMAT,
      bitrate: SERVER_TTS_MP3_BITRATE,
    });

    await setProgress({
      jobId: job.id,
      stage: 'audio',
      current: idx + 1,
      total,
      message: `Saved audio for #${summary.id} ${summary.name}.`,
    });

    if (idx < summaries.length - 1) {
      const cooldownMs = jitteredCooldown(SERVER_TTS_COOLDOWN_MS);
      const cooldownUntil = new Date(Date.now() + cooldownMs).toISOString();
      await db.setJobCooldownUntil(job.id, cooldownUntil);
      const result = await sleepWithJobControl(job.id, cooldownMs);
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
  const db = await getDatabase();
  const runningJobs = await db.getAllRunningJobs();

  const textJobCount = runningJobs.filter(j => j.stage === 'summary').length;
  const audioJobCount = runningJobs.filter(j => j.stage === 'audio').length;

  const canClaimTextJob = textJobCount < MAX_CONCURRENT_TEXT_JOBS;
  const canClaimAudioJob = audioJobCount < MAX_CONCURRENT_AUDIO_JOBS;

  if (!canClaimTextJob && !canClaimAudioJob) {
    return;
  }

  const claimed = await db.claimNextQueuedJob();
  if (!claimed) return;

  const job = claimed.job;
  const shouldProcessJob =
    (job.stage === 'summary' && canClaimTextJob) || (job.stage === 'audio' && canClaimAudioJob);

  if (!shouldProcessJob) {
    await db.setJobStatus(job.id, 'queued');
    return;
  }

  const jobPromise = processJob(job).finally(() => {
    activeJobs.delete(job.id);
  });

  activeJobs.set(job.id, jobPromise);
}

const STALLED_JOB_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

async function checkStalledJobs(): Promise<void> {
  try {
    const db = await getDatabase();
    const recoveredCount = await db.recoverStalledJobs(STALLED_JOB_THRESHOLD_MS);
    if (recoveredCount > 0) {
      console.log(`Recovered ${recoveredCount} stalled jobs.`);
    }
  } catch (error) {
    console.error('Failed to recover stalled jobs:', error);
  }
}

export function startJobRunner(): void {
  if (runnerStarted) return;
  runnerStarted = true;

  // Initial recovery of stalled jobs
  void checkStalledJobs();

  // Periodic stalled job check
  setInterval(() => {
    void checkStalledJobs();
  }, 60000);

  setInterval(() => {
    void tick();
  }, 1000);

  void tick();
}
