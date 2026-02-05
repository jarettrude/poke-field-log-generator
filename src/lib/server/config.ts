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
 *   - Must space TTS calls at least 6s apart (we use 5min for safety)
 *   - Max ~100 TTS calls per day
 *
 * NOTE: Batching multiple entries into a single TTS call does NOT work reliably.
 * The model truncates/ignores most of the input. We now use one TTS call per Pokémon.
 */

export const SERVER_SUMMARY_COOLDOWN_MS = 15000;
export const SERVER_TTS_COOLDOWN_MS = 300000;

export const SERVER_TTS_SAMPLE_RATE = 24000;
export const SERVER_TTS_AUDIO_FORMAT = 'mp3' as const;
export const SERVER_TTS_MP3_BITRATE = 128;

/**
 * Add jitter to a cooldown duration to smooth traffic and prevent thundering herd.
 * Returns a value between 80% and 120% of the base duration.
 */
export function jitteredCooldown(baseMs: number): number {
  const jitterFactor = 0.8 + Math.random() * 0.4;
  return Math.round(baseMs * jitterFactor);
}
