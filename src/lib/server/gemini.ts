/**
 * Server-side Gemini AI client for summary generation and text-to-speech.
 *
 * Models (as of Oct 2026):
 * - Summaries: cascades gemini-3.8 → 3.7 → 3.6 → 3.5 → 2.5 flash models;
 *   each has its own quota pool so a saturated model falls through
 * - gemini-3.8-flash-tts: primary TTS (stable, free tier eligible)
 * - gemini-3.8-flash-lite-tts: fallback TTS (stable, free tier eligible)
 *
 * Per-model free-tier rate limits are not published; view the active
 * limits for your project in Google AI Studio. Requires
 * @google/genai >= 2.24.0 for the 3.8 TTS models.
 */

import { GoogleGenAI, Modality, Type } from '@google/genai';
import type { PokemonDetails } from '@/types';
import { getActivePrompt } from './prompts';

const MAX_RETRIES = 4;
const MAX_RETRIES_TTS = 1;
const MAX_RETRIES_SUMMARY = 1;

const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 64000;
const RATE_LIMIT_BASE_MS = 30000;
const RATE_LIMIT_MAX_MS = 120000;

// ---------------------------------------------------------------------------
// Batch-level TTS quota tracking
// ---------------------------------------------------------------------------
// Within a single batch, once a model's daily quota is exhausted we skip it
// for all remaining items. This avoids wasting API calls on a model we know
// is maxed out. Each new batch should call resetBatchQuotaState().

interface BatchQuotaState {
  summaryExhausted: Set<string>;
  primaryExhausted: boolean;
  fallbackExhausted: boolean;
}

const batchQuota: BatchQuotaState = {
  summaryExhausted: new Set(),
  primaryExhausted: false,
  fallbackExhausted: false,
};

// Cascading fallback for summary generation. Each model has its own quota
// pool, so a saturated model can be skipped mid-batch for an older one.
// Ordered newest → oldest; all are free-tier eligible text models.
const SUMMARY_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
] as const;
const TTS_PRIMARY_MODEL = 'gemini-3.8-flash-tts';
const TTS_FALLBACK_MODEL = 'gemini-3.8-flash-lite-tts';

/**
 * Reset batch quota state. Call at the start of every new batch.
 */
export function resetBatchQuotaState(): void {
  batchQuota.summaryExhausted.clear();
  batchQuota.primaryExhausted = false;
  batchQuota.fallbackExhausted = false;
}

/**
 * Custom error thrown when ALL TTS models have exhausted their daily quota.
 * The jobRunner should catch this to stop the batch gracefully and show
 * partial results + a user-friendly message.
 */
export class TtsQuotaExhaustedError extends Error {
  constructor(message?: string) {
    super(
      message ||
        'All TTS models have exceeded their daily API quota. Try again tomorrow after midnight Pacific Time.'
    );
    this.name = 'TtsQuotaExhaustedError';
  }
}

/**
 * Check if error is a daily quota exhaustion (not recoverable by retrying).
 *
 * Google API 429 errors include quota violation details:
 * - Daily limits: "GenerateRequestsPerDayPerProjectPerModel", "per_day", "PerDay"
 * - Per-minute limits: "PerMinute", "per_minute" (these ARE recoverable with backoff)
 *
 * Daily quota exhaustion should trigger immediate fallback, not retry.
 */
function isDailyQuotaExhausted(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message;

    const hasDailyQuotaIndicator =
      msg.includes('PerDay') ||
      msg.includes('per_day') ||
      msg.includes('_per_model_per_day') ||
      msg.includes('requests_per_day');

    const isQuotaCompletelyExhausted =
      msg.includes('limit: 0') && msg.includes('RESOURCE_EXHAUSTED');

    const isPerMinuteLimit = msg.includes('PerMinute') || msg.includes('per_minute');

    if (isPerMinuteLimit) {
      return false;
    }

    return hasDailyQuotaIndicator || isQuotaCompletelyExhausted;
  }
  return false;
}

/**
 * Check if error is retryable (transient rate limits, server errors).
 * Daily quota exhaustion is NOT retryable - should fall back instead.
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    if (isDailyQuotaExhausted(error)) {
      return false;
    }
    const msg = error.message;
    return (
      msg.includes('429') ||
      msg.includes('503') ||
      msg.includes('500') ||
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('overloaded')
    );
  }
  return false;
}

function calculateBackoff(attempt: number, isRateLimit: boolean): number {
  const baseMs = isRateLimit ? RATE_LIMIT_BASE_MS : BACKOFF_BASE_MS;
  const maxMs = isRateLimit ? RATE_LIMIT_MAX_MS : BACKOFF_MAX_MS;

  const exponentialDelay = Math.min(baseMs * 2 ** attempt, maxMs);

  const jitter = exponentialDelay * (0.5 + Math.random());

  return Math.min(jitter, maxMs);
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries: number = MAX_RETRIES): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error;
      }
      const isRateLimit =
        error instanceof Error &&
        (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED'));

      const wait = calculateBackoff(attempt, isRateLimit);
      console.warn(
        `API error (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${Math.round(wait / 1000)}s...`,
        error instanceof Error ? error.message : error
      );
      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }
  throw lastError;
}

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Missing GEMINI_API_KEY');
  }
  return key;
}

function getClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: getApiKey() });
}

/**
 * Generate a field-log summary for a Pokémon using Gemini.
 */
export async function generateSummary(details: PokemonDetails, region: string): Promise<string> {
  const ai = getClient();
  const systemPrompt = await getActivePrompt('summary');

  const pokemonContext = `
    ---
    ID: ${details.id}
    Name: ${details.name}
    Region: ${region}
    Types: ${details.types.join(', ')}
    Physicals: ${details.height / 10}m, ${details.weight / 10}kg
    Habitat: ${details.habitat}
    Lore Context: ${details.flavorTexts.join(' ')}
    Available Moves: ${details.allMoveNames.slice(0, 30).join(', ')}
  `;

  const prompt = `${systemPrompt}\n\nPOKEMON DATA:\n${pokemonContext}`;

  const makeSummaryRequest = async (model: string): Promise<string> => {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.85,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: 'The immersive Trainer Log paragraph' },
          },
          required: ['summary'],
        },
      },
    });

    let text = response.text;
    if (!text) {
      const candidate = response.candidates?.[0];
      if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
        throw new Error(`Gemini generation stopped: ${candidate.finishReason}`);
      }
      text = '{}';
    }

    let parsed: { summary?: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Failed to parse Gemini response: ${text.substring(0, 100)}...`);
    }

    if (!parsed.summary) {
      throw new Error('Gemini returned valid JSON but missing "summary" field.');
    }

    return parsed.summary;
  };

  // Try each model in cascade order. Daily quota exhaustion and persistent
  // unavailability (e.g. sustained 503 overload) mark the model for the rest
  // of the batch so we stop wasting calls on it. Non-retryable errors
  // (bad request, auth) fail fast — every model would reject the same input.
  let lastError: unknown;
  for (const model of SUMMARY_MODELS) {
    if (batchQuota.summaryExhausted.has(model)) {
      console.log(`Skipping ${model} (unavailable earlier in this batch).`);
      continue;
    }

    try {
      return await withRetry(() => makeSummaryRequest(model), MAX_RETRIES_SUMMARY);
    } catch (error) {
      lastError = error;
      if (isDailyQuotaExhausted(error)) {
        console.warn(`${model} daily quota exhausted. Trying next model in cascade...`);
      } else if (isRetryableError(error)) {
        console.warn(`${model} still unavailable after retries. Trying next model in cascade...`);
      } else {
        throw error;
      }
      batchQuota.summaryExhausted.add(model);
    }
  }

  throw lastError ?? new Error('All summary models exhausted.');
}

/**
 * Generate TTS audio from text using Gemini. Returns base64-encoded audio.
 *
 * Gemini 3.8 TTS treats input text strictly as a verbatim transcript, so the
 * Director's Note prompt is passed as `speechMetadata.style` rather than
 * embedded in the text. Unary requests return `audio/wav` by default; the
 * audio converter detects the RIFF header automatically.
 *
 * Strategy: Flash TTS first with 1 retry, then Flash-Lite TTS fallback with
 * 1 retry. Max 4 API calls per Pokémon.
 *
 * Daily quota exhaustion (RPD) triggers IMMEDIATE fallback (no retries).
 * Transient rate limits (RPM) retry with exponential backoff (30s base).
 * The jobRunner does NOT add its own retry layer on top of this.
 *
 * Batch-level optimization: Once a model's daily quota is exhausted within
 * a batch, it is skipped for all remaining items. If both models are
 * exhausted, throws TtsQuotaExhaustedError so the batch can stop gracefully.
 */
export async function generateTts(params: { text: string; voiceName: string }): Promise<string> {
  // If both models are already known-exhausted, fail immediately
  if (batchQuota.primaryExhausted && batchQuota.fallbackExhausted) {
    throw new TtsQuotaExhaustedError();
  }

  const ai = getClient();
  const instruction = await getActivePrompt('tts');

  const makeTtsRequest = async (model: string) => {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: params.text,
              speechMetadata: { style: instruction },
            },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { voice: params.voiceName },
        },
      },
    });

    const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data) {
      throw new Error('Voice engine failed to respond with data.');
    }

    const mimeType = inlineData.mimeType ?? 'unknown';
    if (
      mimeType !== 'unknown' &&
      !mimeType.startsWith('audio/L16') &&
      !mimeType.startsWith('audio/pcm') &&
      !mimeType.startsWith('audio/wav')
    ) {
      console.warn(
        `Unexpected TTS mimeType: ${mimeType}. Expected audio/wav, audio/L16, or audio/pcm.`
      );
    }

    return inlineData.data;
  };

  // Try the primary model first (unless already exhausted for this batch)
  if (!batchQuota.primaryExhausted) {
    try {
      console.log(`Attempting TTS with ${TTS_PRIMARY_MODEL}...`);
      return await withRetry(() => makeTtsRequest(TTS_PRIMARY_MODEL), MAX_RETRIES_TTS);
    } catch (primaryError) {
      if (isDailyQuotaExhausted(primaryError)) {
        batchQuota.primaryExhausted = true;
        console.warn(`${TTS_PRIMARY_MODEL} daily quota exhausted. Skipping it for rest of batch.`);
      } else {
        console.warn(
          `${TTS_PRIMARY_MODEL} failed (exhausted all retries). Falling back to ${TTS_FALLBACK_MODEL}...`
        );
      }
    }
  } else {
    console.log(
      `Skipping ${TTS_PRIMARY_MODEL} (daily quota already exhausted this batch). Using ${TTS_FALLBACK_MODEL}...`
    );
  }

  // Try the fallback model (unless already exhausted for this batch)
  if (!batchQuota.fallbackExhausted) {
    try {
      return await withRetry(() => makeTtsRequest(TTS_FALLBACK_MODEL), MAX_RETRIES_TTS);
    } catch (fallbackError) {
      if (isDailyQuotaExhausted(fallbackError)) {
        batchQuota.fallbackExhausted = true;
        console.warn(`${TTS_FALLBACK_MODEL} daily quota exhausted. All TTS models exhausted.`);
      } else {
        // Non-quota error on fallback — re-throw as-is
        throw fallbackError;
      }
    }
  }

  // If we reach here, both models are exhausted
  throw new TtsQuotaExhaustedError();
}
