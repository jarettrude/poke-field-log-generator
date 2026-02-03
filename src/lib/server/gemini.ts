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

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
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
      model: 'gemini-2.0-flash',
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

    const text = response.text || '{}';
    const parsed = JSON.parse(text) as { summary?: string };
    return parsed.summary || '';
  }, MAX_RETRIES);
}

/**
 * Generate TTS audio from text using Gemini. Returns base64-encoded PCM audio.
 *
 * Note: gemini-2.5-flash-preview-tts has an 8,192 token input limit (~6,000 words).
 * Callers should use chunkSummariesByCharLimit() to ensure batches fit within limits.
 */
export async function generateTts(params: {
  text: string;
  voiceName: string;
  isBulk: boolean;
}): Promise<string> {
  return withRetry(async () => {
    const ai = getClient();
    const baseInstruction = await getActivePrompt('tts');

    const bulkInstruction = params.isBulk
      ? "\n\nCRITICAL: Multiple entries provided. Pause for exactly 3 seconds at every '[PAUSE]' marker. Maintain consistent tone and pacing throughout."
      : '';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [
        {
          parts: [
            {
              text: `${baseInstruction}${bulkInstruction}\n\nTEXT:\n${params.text}`,
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

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('Voice engine failed to respond with data.');
    }

    return base64Audio;
  }, MAX_RETRIES_TTS);
}

/**
 * Combine multiple summaries into TTS-ready text with pause markers.
 */
export function combineSummariesForTts(
  summaries: { id: number; name: string; text: string }[]
): string {
  return summaries.map(s => s.text).join('\n\n[PAUSE]\n\n');
}
