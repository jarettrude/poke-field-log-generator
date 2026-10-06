/**
 * Audio conversion utilities using ffmpeg-static.
 * Converts TTS audio (raw PCM or WAV) to MP3 format for optimized storage.
 */

import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

/**
 * Convert base64-encoded audio to base64-encoded MP3.
 *
 * Accepts either headerless PCM16LE (mono) or a RIFF/WAV container — the
 * format is detected from the RIFF magic bytes. Gemini 3.8 TTS models
 * return `audio/wav` by default on unary requests, while older models and
 * explicit `audio/l16` responses are headerless PCM.
 *
 * @param pcmBase64 Base64-encoded PCM16LE or WAV data (mono).
 * @param sampleRate Sample rate in Hz for raw PCM input (default: 24000).
 * @param bitrate MP3 bitrate in kbps (default: 128).
 * @returns Promise resolving to base64-encoded MP3 data.
 */
export async function convertPcmToMp3(
  pcmBase64: string,
  sampleRate: number = 24000,
  bitrate: number = 128
): Promise<string> {
  if (!ffmpegPath) {
    throw new Error('ffmpeg-static path not found');
  }

  return new Promise((resolve, reject) => {
    const pcmBuffer = Buffer.from(pcmBase64, 'base64');

    if (pcmBuffer.length === 0) {
      reject(
        new Error('Audio input buffer is empty (0 bytes). TTS response may have been invalid.')
      );
      return;
    }

    const isWav =
      pcmBuffer.length > 12 &&
      pcmBuffer.toString('latin1', 0, 4) === 'RIFF' &&
      pcmBuffer.toString('latin1', 8, 12) === 'WAVE';

    console.log(
      `[audioConverter] Converting ${isWav ? 'WAV' : 'PCM'}→MP3: ${pcmBuffer.length} bytes, ${sampleRate}Hz, ${bitrate}kbps`
    );

    const inputArgs = isWav
      ? ['-i', 'pipe:0']
      : ['-f', 's16le', '-ar', sampleRate.toString(), '-ac', '1', '-i', 'pipe:0'];

    const ffmpeg = spawn(ffmpegPath as string, [
      ...inputArgs,
      '-f',
      'mp3',
      '-ab',
      `${bitrate}k`,
      '-y',
      'pipe:1',
    ]);

    const chunks: Buffer[] = [];
    const errorChunks: Buffer[] = [];

    ffmpeg.stdout.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    ffmpeg.stderr.on('data', (chunk: Buffer) => {
      errorChunks.push(chunk);
    });

    ffmpeg.on('close', (code: number | null) => {
      if (code === 0) {
        const mp3Buffer = Buffer.concat(chunks);
        const mp3Base64 = mp3Buffer.toString('base64');
        resolve(mp3Base64);
      } else {
        const errorMessage = Buffer.concat(errorChunks).toString('utf-8');
        reject(new Error(`FFmpeg conversion failed with code ${code}: ${errorMessage}`));
      }
    });

    ffmpeg.on('error', (error: Error) => {
      reject(new Error(`FFmpeg process error: ${error.message}`));
    });

    ffmpeg.stdin.write(pcmBuffer);
    ffmpeg.stdin.end();
  });
}
