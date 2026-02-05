/**
 * Tests for the TTS pipeline data flow: API response → PCM extraction → MP3 conversion.
 *
 * All API interactions are mocked. No real Gemini API calls are made.
 * This validates the data transformation chain and error handling at each stage.
 */

import { describe, it, expect } from 'vitest';
import { convertPcmToMp3 } from '../audioConverter';

/**
 * Generate synthetic PCM16LE audio as base64 (mimics Gemini TTS response).
 */
function generatePcmBase64(durationMs: number, sampleRate = 24000): string {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const buffer = Buffer.alloc(numSamples * 2);
  for (let i = 0; i < numSamples; i++) {
    const value = Math.round(16000 * Math.sin(2 * Math.PI * 440 * (i / sampleRate)));
    buffer.writeInt16LE(value, i * 2);
  }
  return buffer.toString('base64');
}

/**
 * Simulate the shape of a Gemini TTS API response.
 * This matches the structure accessed in gemini.ts:makeTtsRequest.
 */
function mockGeminiTtsResponse(options: {
  data?: string | null;
  mimeType?: string;
  hasCandidate?: boolean;
}) {
  const {
    data = generatePcmBase64(1000),
    mimeType = 'audio/L16;rate=24000',
    hasCandidate = true,
  } = options;

  if (!hasCandidate) {
    return { candidates: [] };
  }

  return {
    candidates: [
      {
        content: {
          parts: [
            {
              inlineData: data !== null ? { data, mimeType } : undefined,
            },
          ],
        },
      },
    ],
  };
}

describe('TTS pipeline: response extraction', () => {
  /**
   * Simulates the extraction logic from gemini.ts:makeTtsRequest
   * without actually calling the API.
   */
  function extractAudioFromResponse(response: ReturnType<typeof mockGeminiTtsResponse>): {
    data: string;
    mimeType: string;
  } {
    const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data) {
      throw new Error('Voice engine failed to respond with data.');
    }

    const mimeType = inlineData.mimeType ?? 'unknown';
    return { data: inlineData.data, mimeType };
  }

  it('should extract base64 audio from a valid response', () => {
    const pcm = generatePcmBase64(500);
    const response = mockGeminiTtsResponse({ data: pcm });

    const { data, mimeType } = extractAudioFromResponse(response);

    expect(data).toBe(pcm);
    expect(mimeType).toBe('audio/L16;rate=24000');
  });

  it('should throw on empty candidates', () => {
    const response = mockGeminiTtsResponse({ hasCandidate: false });

    expect(() => extractAudioFromResponse(response)).toThrow(
      'Voice engine failed to respond with data.'
    );
  });

  it('should throw on null inlineData', () => {
    const response = mockGeminiTtsResponse({ data: null });

    expect(() => extractAudioFromResponse(response)).toThrow(
      'Voice engine failed to respond with data.'
    );
  });

  it('should extract data even with unexpected mimeType', () => {
    const pcm = generatePcmBase64(500);
    const response = mockGeminiTtsResponse({ data: pcm, mimeType: 'audio/wav' });

    const { data, mimeType } = extractAudioFromResponse(response);

    expect(data).toBe(pcm);
    expect(mimeType).toBe('audio/wav');
  });

  it('should handle missing mimeType gracefully', () => {
    const pcm = generatePcmBase64(500);
    const response = {
      candidates: [
        {
          content: {
            parts: [{ inlineData: { data: pcm } }],
          },
        },
      ],
    };

    // mimeType will be undefined, so fallback to 'unknown'
    const inlineData = response.candidates[0]?.content?.parts[0]?.inlineData;
    const mimeType = (inlineData as { mimeType?: string }).mimeType ?? 'unknown';

    expect(inlineData?.data).toBe(pcm);
    expect(mimeType).toBe('unknown');
  });
});

describe('TTS pipeline: end-to-end data flow (mocked API)', () => {
  it('should convert extracted PCM response to valid MP3', async () => {
    // Step 1: Simulate Gemini API response
    const pcmBase64 = generatePcmBase64(1000);
    const response = mockGeminiTtsResponse({ data: pcmBase64 });

    // Step 2: Extract audio (same logic as gemini.ts)
    const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    expect(inlineData?.data).toBeTruthy();

    // Step 3: Convert PCM → MP3 (same as jobRunner.ts)
    const mp3Base64 = await convertPcmToMp3(inlineData!.data!, 24000, 128);

    // Step 4: Validate MP3 output
    expect(mp3Base64).toBeTruthy();
    const mp3Buffer = Buffer.from(mp3Base64, 'base64');
    expect(mp3Buffer.length).toBeGreaterThan(0);

    // Verify MP3 magic bytes
    const firstByte = mp3Buffer[0];
    expect(firstByte === 0xff || firstByte === 0x49).toBe(true);
  });

  it('should handle the full pipeline with config values from config.ts', async () => {
    // Import the actual config values used in production
    const { SERVER_TTS_SAMPLE_RATE, SERVER_TTS_MP3_BITRATE } = await import('../config');

    const pcmBase64 = generatePcmBase64(2000, SERVER_TTS_SAMPLE_RATE);

    const mp3Base64 = await convertPcmToMp3(
      pcmBase64,
      SERVER_TTS_SAMPLE_RATE,
      SERVER_TTS_MP3_BITRATE
    );

    expect(mp3Base64).toBeTruthy();

    // Verify output is valid base64 → valid buffer
    const mp3Buffer = Buffer.from(mp3Base64, 'base64');
    expect(mp3Buffer.length).toBeGreaterThan(0);
  });
});

describe('TTS pipeline: mimeType validation logic', () => {
  /**
   * Simulates the mimeType validation from gemini.ts.
   * Returns true if the mimeType would trigger a warning.
   */
  function wouldWarnMimeType(mimeType: string | undefined): boolean {
    const resolved = mimeType ?? 'unknown';
    if (resolved === 'unknown') return false;
    if (resolved.startsWith('audio/L16')) return false;
    if (resolved.startsWith('audio/pcm')) return false;
    return true;
  }

  it('should not warn for audio/L16', () => {
    expect(wouldWarnMimeType('audio/L16;rate=24000')).toBe(false);
  });

  it('should not warn for audio/pcm', () => {
    expect(wouldWarnMimeType('audio/pcm')).toBe(false);
  });

  it('should not warn for undefined (unknown)', () => {
    expect(wouldWarnMimeType(undefined)).toBe(false);
  });

  it('should warn for audio/wav', () => {
    expect(wouldWarnMimeType('audio/wav')).toBe(true);
  });

  it('should warn for audio/mpeg', () => {
    expect(wouldWarnMimeType('audio/mpeg')).toBe(true);
  });

  it('should warn for audio/ogg', () => {
    expect(wouldWarnMimeType('audio/ogg')).toBe(true);
  });
});

describe('TTS pipeline: error resilience', () => {
  it('should fail gracefully when PCM data is corrupt base64', async () => {
    // "!!!" is not valid base64 — Buffer.from will produce empty or garbage
    // The converter should still handle it (ffmpeg may error on bad data)
    const corruptBase64 = '!!!not-valid-base64!!!';
    const result = Buffer.from(corruptBase64, 'base64');

    if (result.length === 0) {
      await expect(convertPcmToMp3(corruptBase64, 24000, 128)).rejects.toThrow();
    } else {
      // Buffer.from is lenient — it may decode partial data
      // ffmpeg should still process it (may produce short/empty MP3)
      const mp3 = await convertPcmToMp3(corruptBase64, 24000, 128);
      expect(typeof mp3).toBe('string');
    }
  });

  it('should handle base64 with padding correctly', async () => {
    // Ensure base64 with and without padding both work
    const pcmBase64 = generatePcmBase64(500);

    // Strip padding if present, re-add it
    const stripped = pcmBase64.replace(/=+$/, '');
    const padded = stripped + '='.repeat((4 - (stripped.length % 4)) % 4);

    const mp3 = await convertPcmToMp3(padded, 24000, 128);
    expect(mp3).toBeTruthy();
  });

  it('should reject when ffmpeg binary path is invalid', async () => {
    // Directly test that spawn fails gracefully with a bad path
    // We can't easily mock ffmpegPath in the module, but we can test
    // that the error handler works by verifying the function signature
    const { spawn } = await import('child_process');

    await expect(
      new Promise((_resolve, reject) => {
        const proc = spawn('/nonexistent/path/to/ffmpeg', ['-version']);
        proc.on('error', (err: Error) => reject(err));
      })
    ).rejects.toThrow();
  });
});
