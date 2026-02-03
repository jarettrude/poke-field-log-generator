/**
 * Server-side configuration constants for job processing and TTS.
 */

export const SERVER_TTS_BATCH_SIZE = 15;

export const SERVER_SUMMARY_COOLDOWN_MS = 15000;
export const SERVER_TTS_COOLDOWN_MS = 300000;

export const SERVER_TTS_SAMPLE_RATE = 24000;
export const SERVER_TTS_AUDIO_FORMAT = 'pcm_s16le' as const;
