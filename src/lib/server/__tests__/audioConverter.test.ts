/**
 * Tests for the PCM → MP3 audio conversion pipeline.
 *
 * These tests exercise convertPcmToMp3 with synthetic PCM data and
 * do NOT call any external API. They validate:
 *   - ffmpeg-static binary resolution
 *   - Correct MP3 output from valid PCM input
 *   - Error handling for empty/corrupt input
 *   - Edge cases (silence, very short audio, large audio)
 */

import { describe, it, expect } from 'vitest';
import { convertPcmToMp3 } from '../audioConverter';

/**
 * Generate synthetic PCM16LE (signed 16-bit little-endian, mono) audio.
 *
 * Produces a sine wave tone so the resulting MP3 has real audio content.
 * This mimics what Gemini TTS returns (base64-encoded raw PCM).
 */
function generatePcmBase64(options: {
  durationMs: number;
  sampleRate?: number;
  frequencyHz?: number;
  amplitude?: number;
}): string {
  const { durationMs, sampleRate = 24000, frequencyHz = 440, amplitude = 16000 } = options;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const buffer = Buffer.alloc(numSamples * 2); // 2 bytes per sample (16-bit)

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const value = Math.round(amplitude * Math.sin(2 * Math.PI * frequencyHz * t));
    buffer.writeInt16LE(value, i * 2);
  }

  return buffer.toString('base64');
}

/** Generate silence (all zeros) as base64 PCM. */
function generateSilencePcmBase64(durationMs: number, sampleRate = 24000): string {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const buffer = Buffer.alloc(numSamples * 2); // Already zeroed
  return buffer.toString('base64');
}

describe('convertPcmToMp3', () => {
  it('should convert valid PCM audio to MP3', async () => {
    const pcmBase64 = generatePcmBase64({ durationMs: 1000 });

    const mp3Base64 = await convertPcmToMp3(pcmBase64, 24000, 128);

    expect(mp3Base64).toBeTruthy();
    expect(mp3Base64.length).toBeGreaterThan(0);

    // Verify it's valid base64
    const mp3Buffer = Buffer.from(mp3Base64, 'base64');
    expect(mp3Buffer.length).toBeGreaterThan(0);

    // MP3 files start with frame sync (0xFF 0xFB) or ID3 tag (0x49 0x44 0x33)
    const firstByte = mp3Buffer[0];
    const isValidMp3Start = firstByte === 0xff || firstByte === 0x49;
    expect(isValidMp3Start).toBe(true);
  });

  it('should produce smaller output than raw PCM input', async () => {
    const pcmBase64 = generatePcmBase64({ durationMs: 2000 });
    const pcmSize = Buffer.from(pcmBase64, 'base64').length;

    const mp3Base64 = await convertPcmToMp3(pcmBase64, 24000, 128);
    const mp3Size = Buffer.from(mp3Base64, 'base64').length;

    // MP3 at 128kbps should be significantly smaller than raw PCM at 24kHz/16bit
    // PCM: 24000 * 2 * 2 = 96000 bytes for 2s
    // MP3: ~128000/8 * 2 = ~32000 bytes for 2s
    expect(mp3Size).toBeLessThan(pcmSize);
  });

  it('should handle silence without errors', async () => {
    const silenceBase64 = generateSilencePcmBase64(500);

    const mp3Base64 = await convertPcmToMp3(silenceBase64, 24000, 128);

    expect(mp3Base64).toBeTruthy();
    const mp3Buffer = Buffer.from(mp3Base64, 'base64');
    expect(mp3Buffer.length).toBeGreaterThan(0);
  });

  it('should handle very short audio (50ms)', async () => {
    const pcmBase64 = generatePcmBase64({ durationMs: 50 });

    const mp3Base64 = await convertPcmToMp3(pcmBase64, 24000, 128);

    expect(mp3Base64).toBeTruthy();
  });

  it('should handle longer audio (10s)', async () => {
    const pcmBase64 = generatePcmBase64({ durationMs: 10000 });

    const mp3Base64 = await convertPcmToMp3(pcmBase64, 24000, 128);

    expect(mp3Base64).toBeTruthy();
    const mp3Buffer = Buffer.from(mp3Base64, 'base64');
    expect(mp3Buffer.length).toBeGreaterThan(0);
  }, 15000);

  it('should reject empty base64 input', async () => {
    await expect(convertPcmToMp3('', 24000, 128)).rejects.toThrow(/empty/i);
  });

  it('should respect different sample rates', async () => {
    const pcmBase64 = generatePcmBase64({ durationMs: 1000, sampleRate: 16000 });

    // Convert with matching sample rate
    const mp3Base64 = await convertPcmToMp3(pcmBase64, 16000, 128);

    expect(mp3Base64).toBeTruthy();
    const mp3Buffer = Buffer.from(mp3Base64, 'base64');
    expect(mp3Buffer.length).toBeGreaterThan(0);
  });

  it('should respect different bitrates', async () => {
    const pcmBase64 = generatePcmBase64({ durationMs: 2000 });

    const [mp3Low, mp3High] = await Promise.all([
      convertPcmToMp3(pcmBase64, 24000, 64),
      convertPcmToMp3(pcmBase64, 24000, 192),
    ]);

    const lowSize = Buffer.from(mp3Low, 'base64').length;
    const highSize = Buffer.from(mp3High, 'base64').length;

    // Higher bitrate should produce larger file
    expect(highSize).toBeGreaterThan(lowSize);
  });
});

describe('ffmpeg-static binary', () => {
  it('should resolve ffmpeg-static path', async () => {
    const ffmpegPath = (await import('ffmpeg-static')).default;
    expect(ffmpegPath).toBeTruthy();
    expect(typeof ffmpegPath).toBe('string');
  });

  it('should point to an existing binary', async () => {
    const ffmpegPath = (await import('ffmpeg-static')).default;
    const { existsSync } = await import('fs');
    expect(existsSync(ffmpegPath as string)).toBe(true);
  });
});
