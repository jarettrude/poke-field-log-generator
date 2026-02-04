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
 * Strategy: Start with gemini-2.5-pro-preview-tts with full retry/backoff logic.
 * If Pro exhausts all retries, fall back to gemini-2.5-flash-preview-tts.
 * This effectively doubles our TTS API capacity.
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

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('Voice engine failed to respond with data.');
    }

    return base64Audio;
  };

  try {
    console.log('Attempting TTS with gemini-2.5-pro-preview-tts...');
    return await withRetry(
      () => makeTtsRequest('gemini-2.5-pro-preview-tts'),
      MAX_RETRIES_TTS
    );
  } catch (proError) {
    console.warn(
      'gemini-2.5-pro-preview-tts exhausted all retries. Falling back to gemini-2.5-flash-preview-tts...'
    );
    
    return await withRetry(
      () => makeTtsRequest('gemini-2.5-flash-preview-tts'),
      MAX_RETRIES_TTS
    );
  }
}
