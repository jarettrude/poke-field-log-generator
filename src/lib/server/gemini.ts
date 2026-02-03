/**
 * Server-side Gemini AI client for summary generation and text-to-speech.
 */

import { GoogleGenAI, Modality, Type } from '@google/genai';
import type { PokemonDetails } from '@/types';
import { getActivePrompt } from './prompts';

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
}

/**
 * Generate TTS audio from text using Gemini. Returns base64-encoded PCM audio.
 */
export async function generateTts(params: {
  text: string;
  voiceName: string;
  isBulk: boolean;
}): Promise<string> {
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
}

/**
 * Combine multiple summaries into TTS-ready text with pause markers.
 */
export function combineSummariesForTts(
  summaries: { id: number; name: string; text: string }[]
): string {
  return summaries.map(s => s.text).join('\n\n[PAUSE]\n\n');
}
