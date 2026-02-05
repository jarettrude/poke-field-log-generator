/**
 * Audio conversion utilities using ffmpeg-static.
 * Converts PCM audio to MP3 format for optimized storage.
 */

import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

/**
 * Convert base64-encoded PCM audio to base64-encoded MP3.
 *
 * @param pcmBase64 Base64-encoded PCM16LE data (mono).
 * @param sampleRate Sample rate in Hz (default: 24000).
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
      reject(new Error('PCM input buffer is empty (0 bytes). TTS response may have been invalid.'));
      return;
    }

    console.log(
      `[audioConverter] Converting PCM→MP3: ${pcmBuffer.length} bytes, ${sampleRate}Hz, ${bitrate}kbps`
    );

    const ffmpeg = spawn(ffmpegPath as string, [
      '-f',
      's16le',
      '-ar',
      sampleRate.toString(),
      '-ac',
      '1',
      '-i',
      'pipe:0',
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
