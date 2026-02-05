/**
 * Server-side Gemini AI client for summary generation and text-to-speech.
 */

import { GoogleGenAI, Modality, Type } from '@google/genai';
import type { PokemonDetails } from '@/types';
import { getActivePrompt } from './prompts';

const MAX_RETRIES = 4;
const MAX_RETRIES_TTS = 5;

const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 64000;
const RATE_LIMIT_BASE_MS = 15000;
const RATE_LIMIT_MAX_MS = 120000;

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

    // Check for daily quota identifiers from Google's QuotaFailure details
    const hasDailyQuotaIndicator =
      msg.includes('PerDay') || // "GenerateRequestsPerDayPerProjectPerModel"
      msg.includes('per_day') || // Alternative format
      msg.includes('_per_model_per_day') || // Full metric name pattern
      msg.includes('requests_per_day'); // Another variant

    // "limit: 0" with RESOURCE_EXHAUSTED means quota completely used up
    const isQuotaCompletelyExhausted =
      msg.includes('limit: 0') && msg.includes('RESOURCE_EXHAUSTED');

    // If it's a per-minute limit, it's NOT daily exhaustion (should retry)
    const isPerMinuteLimit = msg.includes('PerMinute') || msg.includes('per_minute');

    if (isPerMinuteLimit) {
      return false; // Per-minute limits are recoverable
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
    // Daily quota exhaustion should NOT be retried - fall back immediately
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

  const exponentialDelay = Math.min(baseMs * Math.pow(2, attempt), maxMs);

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
  return withRetry(async () => {
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

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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

    // Handle potential SDK variations or empty responses
    let text = response.text;
    if (!text) {
      // Check for candidates to provide better error details (e.g., safety blocking)
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
  }, MAX_RETRIES);
}

/**
 * Generate TTS audio from text using Gemini. Returns base64-encoded PCM audio.
 *
 * Strategy: Start with gemini-2.5-pro-preview-tts with retry/backoff for transient errors.
 * If Pro hits daily quota exhaustion OR exhausts all retries, fall back to gemini-2.5-flash-preview-tts.
 *
 * Daily quota exhaustion (RPD) is detected and triggers IMMEDIATE fallback (no retries).
 * Transient rate limits (RPM) will retry with exponential backoff.
 */
export async function generateTts(params: { text: string; voiceName: string }): Promise<string> {
  const ai = getClient();
  const instruction = await getActivePrompt('tts');

  const makeTtsRequest = async (model: string) => {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            {
              text: `${instruction}\n\nTEXT:\n${params.text}`,
            },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: params.voiceName },
          },
        },
      },
    });

    const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data) {
      throw new Error('Voice engine failed to respond with data.');
    }

    const mimeType = inlineData.mimeType ?? 'unknown';
    if (mimeType !== 'unknown' && !mimeType.startsWith('audio/L16') && !mimeType.startsWith('audio/pcm')) {
      console.warn(`Unexpected TTS mimeType: ${mimeType}. Expected audio/L16 or audio/pcm.`);
    }

    return inlineData.data;
  };

  try {
    console.log('Attempting TTS with gemini-2.5-pro-preview-tts...');
    return await withRetry(() => makeTtsRequest('gemini-2.5-pro-preview-tts'), MAX_RETRIES_TTS);
  } catch (proError) {
    // Check if it was daily quota exhaustion (immediate fallback) vs retry exhaustion
    const reason = isDailyQuotaExhausted(proError)
      ? 'daily quota exhausted - immediate fallback'
      : 'exhausted all retries';
    console.warn(
      `gemini-2.5-pro-preview-tts failed (${reason}). Falling back to gemini-2.5-flash-preview-tts...`
    );

    return await withRetry(() => makeTtsRequest('gemini-2.5-flash-preview-tts'), MAX_RETRIES_TTS);
  }
}
