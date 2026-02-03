/**
 * Convert base64-encoded 16-bit PCM mono audio into a WAV `Blob`.
 *
 * @param pcmBase64 Base64-encoded PCM16LE data (mono).
 * @param sampleRate Sample rate in Hz.
 */
export function pcmToWavBlob(pcmBase64: string, sampleRate: number = 24000): Blob {
  const binaryString = atob(pcmBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + len, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, len, true);

  return new Blob([wavHeader, bytes], { type: 'audio/wav' });
}

/**
 * Convert base64-encoded PCM audio into a temporary WAV object URL.
 *
 * @param pcmBase64 Base64-encoded PCM16LE data (mono).
 * @param sampleRate Sample rate in Hz.
 */
export function pcmToWav(pcmBase64: string, sampleRate: number = 24000): string {
  const blob = pcmToWavBlob(pcmBase64, sampleRate);
  return URL.createObjectURL(blob);
}
