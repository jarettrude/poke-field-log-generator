/**
 * Client-side Gemini service module.
 *
 * Note: This module is server-only. Client code should use the /api/jobs
 * endpoints instead of calling these functions directly.
 */

import { GoogleGenAI, Modality, Type } from '@google/genai';
import { PokemonDetails } from '../types';
import { getPrompt } from './promptService';

const BASE_COOLDOWN_MS = 150000;
const MAX_COOLDOWN_MS = 600000;
const COOLDOWN_MULTIPLIER = 1.5;

let currentCooldownMs = BASE_COOLDOWN_MS;

/**
 * Get the current dynamic cooldown value (in milliseconds).
 *
 * This value changes over time based on API errors and is used by the UI layer
 * to decide how long to wait before retrying requests.
 */
export const getCurrentCooldown = () => currentCooldownMs;

/**
 * Reset the dynamic cooldown back to the base value.
 *
 * Call this after successful requests to avoid unnecessarily long waits.
 */
const resetCooldown = () => {
  currentCooldownMs = BASE_COOLDOWN_MS;
};

/**
 * Increase the dynamic cooldown (bounded by `MAX_COOLDOWN_MS`).
 *
 * Call this after transient API errors (rate limiting, overload, etc.).
 */
const increaseCooldown = () => {
  currentCooldownMs = Math.min(currentCooldownMs * COOLDOWN_MULTIPLIER, MAX_COOLDOWN_MS);
};

/**
 * Generate a single Pokémon field-log summary with region context.
 *
 * The response is requested as strict JSON and the returned string is the
 * `summary` field.
 */
export const createSingleSummary = async (
  details: PokemonDetails,
  region: string,
  retryCount = 0
): Promise<string> => {
  if (typeof window !== 'undefined') {
    throw new Error('geminiService is server-only. Use /api/jobs instead.');
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const systemPrompt = await getPrompt('summary');

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

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash', // Using stable model for reliability
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
    const parsed = JSON.parse(text);
    resetCooldown(); // Success - reset cooldown
    return parsed.summary || '';
  } catch (error: unknown) {
    return handleApiError(error as { message?: string; status?: number }, retryCount, () =>
      createSingleSummary(details, region, retryCount + 1)
    );
  }
};

/**
 * Generate TTS audio for one or more field log entries.
 *
 * Returns base64-encoded PCM audio.
 */
export const generateTTS = async (
  text: string,
  voiceName: string = 'Kore',
  isBulk: boolean = false,
  retryCount = 0
): Promise<string> => {
  if (typeof window !== 'undefined') {
    throw new Error('geminiService is server-only. Use /api/jobs instead.');
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const baseInstruction = await getPrompt('tts');

  const bulkInstruction = isBulk
    ? "\n\nCRITICAL: Multiple entries provided. Pause for exactly 3 seconds at every '[PAUSE]' marker. Maintain consistent tone and pacing throughout."
    : '';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [
        {
          parts: [
            {
              text: `${baseInstruction}${bulkInstruction}\n\nTEXT:\n${text}`,
            },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('Voice engine failed to respond with data.');
    }

    resetCooldown();
    return base64Audio;
  } catch (error: unknown) {
    return handleApiError(
      error as { message?: string; status?: number },
      retryCount,
      () => generateTTS(text, voiceName, isBulk, retryCount + 1),
      5 // Max 5 retries for TTS
    );
  }
};

/**
 * Combine multiple summaries into TTS-ready text with pause markers.
 *
 * The Gemini TTS prompt expects `[PAUSE]` markers between entries.
 */
export const combineSummariesForTTS = (
  summaries: { id: number; name: string; text: string }[]
): string => {
  return summaries.map(s => s.text).join('\n\n[PAUSE]\n\n');
};

/**
 * Centralized error handling with exponential backoff
 */
async function handleApiError<T>(
  error: { message?: string; status?: number },
  retryCount: number,
  retryFn: () => Promise<T>,
  maxRetries: number = 4
): Promise<T> {
  const isOverloaded = error.message?.includes('503') || error.status === 503;
  const isRateLimit = error.message?.includes('429') || error.status === 429;
  const isInternalError = error.message?.includes('500') || error.status === 500;

  if ((isOverloaded || isInternalError || isRateLimit) && retryCount < maxRetries) {
    increaseCooldown();
    // specific backoff for rate limits: wait longer (start at 15s, then 30s, etc.)
    const baseWait = isRateLimit ? 15000 : 5000;
    const wait = Math.pow(2, retryCount) * baseWait + Math.random() * 2000;

    console.warn(
      `API Error ${error.status || (isRateLimit ? 429 : 500)}. Retrying in ${Math.round(wait / 1000)}s... (Attempt ${retryCount + 1}/${maxRetries})`
    );
    await new Promise(resolve => setTimeout(resolve, wait));
    return retryFn();
  }

  if (isRateLimit) {
    throw new Error(
      'API_LIMIT_REACHED: Rate limit or daily quota exceeded. The app will retry next time, but you might need to check your API dashboard if this persists.'
    );
  }

  if (typeof error === 'object' && error !== null) {
    console.error('Full API Error Object:', JSON.stringify(error, null, 2));
    if (error.message) console.error('Error Message:', error.message);
    const errorWithDetails = error as { errorDetails?: unknown };
    if (errorWithDetails.errorDetails) {
      console.error('Error Details:', JSON.stringify(errorWithDetails.errorDetails, null, 2));
    }
  }
  const errorMsg =
    typeof error === 'object' && error !== null ? JSON.stringify(error) : String(error);
  throw new Error(errorMsg);
}
