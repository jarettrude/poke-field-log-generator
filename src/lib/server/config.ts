/**
 * Server-side configuration constants for job processing and TTS.
 *
 * Model-specific rate limits (pay-as-you-go):
 *
 * gemini-2.0-flash (text generation):
 *   - RPM: 2,000 | TPM: 4M | RPD: Unlimited
 *   - Stable model with generous limits
 *
 * gemini-2.5-flash-preview-tts (audio generation):
 *   - RPM: 10 | TPM: 10K | RPD: 100
 *   - Preview model with RESTRICTIVE limits
 *   - Input token limit: 8,192 tokens (~6,000 words max)
 *   - Must space TTS calls at least 6s apart (we use 5min for safety)
 *   - Max ~100 TTS batches per day = ~1,500 Pokémon with audio
 */

export const SERVER_TTS_BATCH_SIZE = 5;
export const SERVER_TTS_MAX_CHARS = 12000;

export const SERVER_SUMMARY_COOLDOWN_MS = 15000;
export const SERVER_TTS_COOLDOWN_MS = 300000;

export const SERVER_TTS_SAMPLE_RATE = 24000;
export const SERVER_TTS_AUDIO_FORMAT = 'pcm_s16le' as const;

/**
 * Add jitter to a cooldown duration to smooth traffic and prevent thundering herd.
 * Returns a value between 80% and 120% of the base duration.
 */
export function jitteredCooldown(baseMs: number): number {
  const jitterFactor = 0.8 + Math.random() * 0.4;
  return Math.round(baseMs * jitterFactor);
}
