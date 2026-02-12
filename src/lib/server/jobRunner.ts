/**
 * Background job runner that processes queued summary and TTS generation jobs.
 *
 * The runner polls the database for queued jobs, claims them atomically, and
 * processes them through summary generation and/or audio synthesis stages.
 * Supports pause/resume/cancel controls and enforces cooldowns between API calls.
 *
 * Progress is pushed to clients in real-time via SSE (jobEvents emitter).
 * DB writes persist state for crash recovery; SSE events drive the UI.
 */

import { getDatabase } from '@/lib/db/adapter';
import type { ProcessingJob, ProcessingStage } from '@/lib/db/adapter';
import {
  generateSummary,
  generateTts,
  resetBatchQuotaState,
  TtsQuotaExhaustedError,
} from './gemini';
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
import { jobEvents } from './jobEvents';

const globalRunner = globalThis as unknown as {
  __jobRunnerStarted?: boolean;
  __jobRunnerActiveJobs?: Map<string, Promise<void>>;
  __jobRunnerActiveStages?: Map<string, ProcessingStage>;
};

if (!globalRunner.__jobRunnerActiveJobs) {
  globalRunner.__jobRunnerActiveJobs = new Map();
}
if (!globalRunner.__jobRunnerActiveStages) {
  globalRunner.__jobRunnerActiveStages = new Map();
}

const activeJobs = globalRunner.__jobRunnerActiveJobs;
const activeJobStages = globalRunner.__jobRunnerActiveStages;
const MAX_CONCURRENT_TEXT_JOBS = 3;
const MAX_CONCURRENT_AUDIO_JOBS = 1;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sleep with periodic checks for pause/cancel.
 * No heartbeat writes — SSE makes them unnecessary.
 * Only reads DB to detect status changes from REST commands.
 */
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
    await sleep(2000);
  }
  return 'ok';
}

/**
 * Persist progress to DB and push to SSE subscribers in one call.
 */
async function setProgress(params: {
  jobId: string;
  stage: ProcessingStage;
  current: number;
  total: number;
  message: string;
  cooldownUntil?: string | null;
}): Promise<void> {
  const db = await getDatabase();
  await db.setJobProgress(params.jobId, params.stage, params.current, params.total, params.message);

  jobEvents.emit(params.jobId, {
    type: 'progress',
    jobId: params.jobId,
    status: 'running',
    stage: params.stage,
    current: params.current,
    total: params.total,
    message: params.message,
    cooldownUntil: params.cooldownUntil ?? null,
  });
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
      await setProgress({
        jobId: job.id,
        stage: 'summary',
        current: idx + 1,
        total,
        message: 'Cooling down...',
        cooldownUntil,
      });
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
 *
 * Batch-level quota tracking: resetBatchQuotaState() is called at the
 * start so each new batch gets a fresh chance at Pro. If both Pro and
 * Flash daily quotas are exhausted mid-batch, TtsQuotaExhaustedError
 * is thrown and we save partial progress + a user-friendly error.
 */
async function processAudioStage(job: ProcessingJob): Promise<'ok' | 'paused' | 'canceled'> {
  const db = await getDatabase();

  resetBatchQuotaState();

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

    try {
      const audioData = await generateTts({
        text: summary.summary,
        voiceName: job.voice,
      });

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
    } catch (ttsError) {
      if (ttsError instanceof TtsQuotaExhaustedError) {
        const completed = idx;
        const errorMsg =
          `Daily API quota exceeded: ${completed} of ${total} audio files were generated successfully. ` +
          `The remaining ${total - completed} could not be processed because both TTS models ` +
          `(Pro and Flash) have hit their daily limits. Quotas reset at midnight Pacific Time.`;
        await setProgress({
          jobId: job.id,
          stage: 'audio',
          current: completed,
          total,
          message: errorMsg,
        });
        throw new Error(errorMsg);
      }
      throw ttsError;
    }

    if (idx < summaries.length - 1) {
      const cooldownMs = jitteredCooldown(SERVER_TTS_COOLDOWN_MS);
      const cooldownUntil = new Date(Date.now() + cooldownMs).toISOString();
      await db.setJobCooldownUntil(job.id, cooldownUntil);
      await setProgress({
        jobId: job.id,
        stage: 'audio',
        current: idx + 1,
        total,
        message: 'Cooling down...',
        cooldownUntil,
      });
      const result = await sleepWithJobControl(job.id, cooldownMs);
      await db.setJobCooldownUntil(job.id, null);
      if (result !== 'ok') return result;
    }
  }

  return 'ok';
}

/**
 * Convert raw API error messages into user-friendly descriptions.
 * The error stored in the DB is shown directly to the user on the results page.
 */
function formatUserFriendlyError(rawMessage: string): string {
  if (rawMessage.includes('Daily API quota exceeded:')) {
    return rawMessage;
  }

  if (rawMessage.includes('429') || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    if (
      rawMessage.includes('PerDay') ||
      rawMessage.includes('per_day') ||
      rawMessage.includes('daily')
    ) {
      return 'Daily API rate limit reached. The Gemini API has a daily request cap that has been exceeded. Quotas reset at midnight Pacific Time. Please try again tomorrow.';
    }
    return 'API rate limit reached (too many requests per minute). The system retried automatically but the limit persisted. Please wait a few minutes and try again.';
  }

  if (rawMessage.includes('503') || rawMessage.includes('overloaded')) {
    return "The Gemini API is temporarily overloaded (503 Service Unavailable). This is a temporary issue on Google's end. Please try again in a few minutes.";
  }

  if (rawMessage.includes('500')) {
    return "The Gemini API returned an internal server error (500). This is a temporary issue on Google's end. Please try again shortly.";
  }

  if (rawMessage.includes('Missing GEMINI_API_KEY')) {
    return 'API key not configured. Please set the GEMINI_API_KEY environment variable.';
  }

  if (rawMessage.includes('Missing saved summary')) {
    return rawMessage;
  }

  if (rawMessage.length > 300) {
    return rawMessage.substring(0, 297) + '...';
  }

  return rawMessage;
}

/**
 * Execute a single job through its summary and/or audio stages.
 * Emits SSE events for progress and terminal states.
 */
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
        jobEvents.emit(fresh.id, {
          type: 'completed',
          jobId: fresh.id,
          generationId: fresh.generationId,
          pokemonIds: fresh.pokemonIds,
          mode: fresh.mode,
        });
        return;
      }

      await db.setJobProgress(
        fresh.id,
        'audio',
        0,
        fresh.pokemonIds.length,
        'Preparing audio synthesis...'
      );
      await db.setJobCooldownUntil(fresh.id, null);
      activeJobStages.set(fresh.id, 'audio');
      jobEvents.emit(fresh.id, {
        type: 'progress',
        jobId: fresh.id,
        status: 'running',
        stage: 'audio',
        current: 0,
        total: fresh.pokemonIds.length,
        message: 'Preparing audio synthesis...',
        cooldownUntil: null,
      });

      const audioJob = await db.getJob(fresh.id);
      if (!audioJob) return;

      const audioResult = await processAudioStage(audioJob);
      if (audioResult !== 'ok') return;

      await db.setJobCooldownUntil(audioJob.id, null);
      await db.setJobStatus(audioJob.id, 'completed');
      await setProgress({
        jobId: audioJob.id,
        stage: 'audio',
        current: audioJob.total,
        total: audioJob.total,
        message: 'Completed audio synthesis.',
      });
      jobEvents.emit(audioJob.id, {
        type: 'completed',
        jobId: audioJob.id,
        generationId: audioJob.generationId,
        pokemonIds: audioJob.pokemonIds,
        mode: audioJob.mode,
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
      jobEvents.emit(fresh.id, {
        type: 'completed',
        jobId: fresh.id,
        generationId: fresh.generationId,
        pokemonIds: fresh.pokemonIds,
        mode: fresh.mode,
      });
    }
  } catch (e) {
    const rawMsg = e instanceof Error ? e.message : String(e);
    const friendlyMsg = formatUserFriendlyError(rawMsg);
    await db.setJobError(job.id, friendlyMsg);
    await db.setJobCooldownUntil(job.id, null);
    const failedJob = await db.getJob(job.id);
    if (failedJob) {
      jobEvents.emit(job.id, {
        type: 'failed',
        jobId: job.id,
        error: friendlyMsg,
        generationId: failedJob.generationId,
        pokemonIds: failedJob.pokemonIds,
        mode: failedJob.mode,
      });
    }
  }
}

let tickInProgress = false;

/**
 * Poll for the next queued job and start processing it if capacity allows.
 */
async function tick(): Promise<void> {
  if (tickInProgress) return;
  tickInProgress = true;

  try {
    // Count active jobs by stage
    let activeTextJobs = 0;
    let activeAudioJobs = 0;
    for (const id of activeJobs.keys()) {
      const stage = activeJobStages.get(id);
      if (stage === 'summary') activeTextJobs++;
      else if (stage === 'audio') activeAudioJobs++;
    }

    const canClaimTextJob = activeTextJobs < MAX_CONCURRENT_TEXT_JOBS;
    const canClaimAudioJob = activeAudioJobs < MAX_CONCURRENT_AUDIO_JOBS;

    if (!canClaimTextJob && !canClaimAudioJob) {
      return;
    }

    const allowedStages: ProcessingStage[] = [];
    if (canClaimTextJob) allowedStages.push('summary');
    if (canClaimAudioJob) allowedStages.push('audio');

    const db = await getDatabase();
    const claimed = await db.claimNextQueuedJob(allowedStages);
    if (!claimed) return;

    const job = claimed.job;

    if (activeJobs.has(job.id)) {
      return;
    }

    activeJobStages.set(job.id, job.stage);
    const jobPromise = processJob(job).finally(() => {
      activeJobs.delete(job.id);
      activeJobStages.delete(job.id);
    });

    activeJobs.set(job.id, jobPromise);
  } finally {
    tickInProgress = false;
  }
}

const STALLED_JOB_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Recover jobs stuck in 'running' state beyond the stalled threshold.
 */
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

/**
 * Initialize the singleton job runner. Starts the tick loop and stalled job recovery.
 */
export function startJobRunner(): void {
  if (globalRunner.__jobRunnerStarted) return;
  globalRunner.__jobRunnerStarted = true;
  console.log('Job runner started (single instance via globalThis)');

  void checkStalledJobs();

  setInterval(() => {
    void checkStalledJobs();
  }, 60000);

  setInterval(() => {
    void tick();
  }, 1000);

  void tick();
}
