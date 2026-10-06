/**
 * Live Gemini API verification — hits the real API.
 *
 * Skipped by default. Run explicitly with:
 *   LIVE_GEMINI=1 pnpm vitest run src/lib/server/__tests__/gemini.live.test.ts
 *
 * Requires a valid GEMINI_API_KEY in .env.local. Validates:
 * - gemini-3.8-flash generates a structured summary
 * - gemini-3.8-flash-tts returns playable audio (WAV or raw PCM)
 * - the returned audio converts to a valid MP3 through our ffmpeg pipeline
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PokemonDetails } from '../../../types';
import { convertPcmToMp3 } from '../audioConverter';
import { generateSummary, generateTts } from '../gemini';

// Vitest doesn't auto-load .env.local; parse it without a dotenv dependency.
try {
  const envFile = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
  for (const line of envFile.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    const key = match?.[1];
    const value = match?.[2];
    if (key === undefined || value === undefined || process.env[key]) {
      continue;
    }
    process.env[key] = value.trim().replace(/^["']|["']$/g, '');
  }
} catch {
  // .env.local not found — the suite will be skipped or fail on the key check
}

const LIVE = process.env.LIVE_GEMINI === '1';

const PIKACHU: PokemonDetails = {
  id: 25,
  name: 'pikachu',
  displayName: 'Pikachu',
  height: 4,
  weight: 60,
  types: ['electric'],
  imagePng: null,
  imageSvg: null,
  flavorTexts: [
    'When several of these Pokémon gather, their electricity could build and cause lightning storms.',
  ],
  allMoveNames: ['thunder-shock', 'quick-attack', 'iron-tail', 'thunderbolt'],
  habitat: 'forest',
  generationId: 1,
  region: 'kanto',
  speciesId: 25,
  isDefault: true,
  formName: null,
  variantCategory: 'default',
};

describe.skipIf(!LIVE)('Gemini live API verification', () => {
  it('gemini-3.8-flash generates a structured summary', async () => {
    const summary = await generateSummary(PIKACHU, 'kanto');
    console.log('--- generated summary ---');
    console.log(summary);
    expect(summary.length).toBeGreaterThan(50);
  }, 120_000);

  it('gemini-3.8-flash-tts returns audio that converts to valid MP3', async () => {
    const audioBase64 = await generateTts({
      text: 'Field note twenty-five. The subject discharged a small arc of electricity when approached.',
      voiceName: 'Kore',
    });

    const audio = Buffer.from(audioBase64, 'base64');
    expect(audio.length).toBeGreaterThan(1000);

    const isWav = audio.subarray(0, 4).toString('ascii') === 'RIFF';
    console.log(`--- TTS audio: ${audio.length} bytes, format: ${isWav ? 'WAV' : 'raw PCM'} ---`);

    const mp3Base64 = await convertPcmToMp3(audioBase64, 24000, 128);
    const mp3 = Buffer.from(mp3Base64, 'base64');
    expect(mp3.length).toBeGreaterThan(0);
    // MP3 frame sync (0xFF) or ID3 tag ('I')
    expect(mp3[0] === 0xff || mp3[0] === 0x49).toBe(true);
    console.log(`--- MP3 output: ${mp3.length} bytes ---`);
  }, 120_000);
});
