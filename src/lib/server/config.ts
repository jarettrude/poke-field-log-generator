/**
 * Server-side configuration constants for job processing and TTS.
 *
 * Model-specific rate limits (paid tier 1, as of Feb 2026):
 *
 * gemini-3-flash-preview (text generation):
 *   - RPM: 2,000 | TPM: 4M | RPD: Unlimited
 *   - Stable model with generous limits
 *
 * gemini-2.5-pro-preview-tts (audio generation - primary):
 *   - RPM: 10 | TPM: 1.3K/10K | RPD: 50
 *   - Very limited daily quota — every failed call counts!
 *
 * gemini-2.5-flash-preview-tts (audio generation - fallback):
 *   - RPM: 10 | TPM: 1.35K/10K | RPD: 100
 *   - Used as fallback when Pro daily quota is exhausted
 *
 * TTS retry budget (gemini.ts):
 *   - 1 retry per model, Pro→Flash fallback = max 4 API calls per Pokémon
 *   - Daily quota exhaustion triggers IMMEDIATE fallback (no retries)
 *   - jobRunner does NOT add its own retry layer for TTS
 *
 * NOTE: Batching multiple entries into a single TTS call does NOT work reliably.
 * The model truncates/ignores most of the input. We now use one TTS call per Pokémon.
 */

export const SERVER_SUMMARY_COOLDOWN_MS = 15000;
export const SERVER_TTS_COOLDOWN_MS = 15000;

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
