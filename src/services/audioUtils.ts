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
