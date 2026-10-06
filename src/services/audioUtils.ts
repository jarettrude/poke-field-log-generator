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
