/**
 * Convert base64-encoded MP3 audio into an MP3 `Blob`.
 *
 * @param mp3Base64 Base64-encoded MP3 data.
 */
export function mp3ToBlob(mp3Base64: string): Blob {
  const binaryString = atob(mp3Base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'audio/mpeg' });
}

/**
 * Convert base64-encoded MP3 audio into a temporary MP3 object URL.
 *
 * @param mp3Base64 Base64-encoded MP3 data.
 */
export function mp3ToUrl(mp3Base64: string): string {
  const blob = mp3ToBlob(mp3Base64);
  return URL.createObjectURL(blob);
}

/**
 * Build a WebVTT caption-track URL from a narration transcript.
 * The generated audio is TTS narration of the summary text, so the
 * transcript doubles as the caption content. A single cue spans the
 * whole clip; players clamp it to the actual duration.
 *
 * @param transcript The text that was spoken in the audio, if available.
 */
export function transcriptToCaptionUrl(transcript?: string | null): string {
  const cue = transcript?.replace(/\s+/g, ' ').trim() || 'Transcript not available.';
  const vtt = `WEBVTT\n\n00:00.000 --> 23:59:59.999\n${cue}\n`;
  return URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
}
