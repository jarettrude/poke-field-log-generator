/**
 * Server-side configuration constants for job processing and TTS.
 *
 * Models (as of Oct 2026):
 *
 * Summary text generation cascades through:
 *   gemini-3.8-flash → gemini-3.7-flash → gemini-3.6-flash →
 *   gemini-3.5-flash → gemini-2.5-flash
 *   Each model has an independent quota pool, so persistent 503 overload
 *   or daily-quota exhaustion on one model falls through to the next.
 *   A model marked exhausted is skipped for the rest of the batch.
 *
 * gemini-3.8-flash-tts (audio generation - primary):
 *   - Flagship TTS; free tier eligible
 *
 * gemini-3.8-flash-lite-tts (audio generation - fallback):
 *   - Fast, cost-efficient TTS; free tier eligible
 *   - Used as fallback when the primary model's daily quota is exhausted
 *
 * Per-model rate limits (RPM/RPD) vary by usage tier and are not published
 * for the free tier — check your project's active limits in Google AI Studio.
 *
 * TTS retry budget (gemini.ts):
 *   - 1 retry per model, primary→fallback = max 4 API calls per Pokémon
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
