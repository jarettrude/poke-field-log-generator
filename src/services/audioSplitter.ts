/**
 * Browser-compatible audio splitter using silence detection to segment bulk TTS output.
 */

interface SplitAudioResult {
  segments: string[];
  count: number;
}

function pcmBase64ToSamples(pcmBase64: string): Int16Array {
  const binaryString = atob(pcmBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

function samplesToPcmBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer);
  const chunkSize = 0x8000;
  let binaryString = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binaryString += String.fromCharCode(...chunk);
  }
  return btoa(binaryString);
}

function isSilent(
  samples: Int16Array,
  startIdx: number,
  windowSize: number,
  threshold: number
): boolean {
  let sum = 0;
  const endIdx = Math.min(startIdx + windowSize, samples.length);

  for (let i = startIdx; i < endIdx; i++) {
    sum += Math.abs(samples[i] || 0);
  }

  const average = sum / (endIdx - startIdx);
  return average < threshold;
}

function findSilenceSegments(
  samples: Int16Array,
  sampleRate: number,
  minSilenceDuration: number = 2.0, // 2 seconds minimum silence
  silenceThreshold: number = 500 // Amplitude threshold for silence
): number[] {
  const silencePositions: number[] = [];
  const windowSize = Math.floor(sampleRate * 0.1); // 100ms windows
  const minSilenceSamples = Math.floor(sampleRate * minSilenceDuration);

  let silenceStart = -1;
  let silenceLength = 0;

  for (let i = 0; i < samples.length; i += windowSize) {
    if (isSilent(samples, i, windowSize, silenceThreshold)) {
      if (silenceStart === -1) {
        silenceStart = i;
      }
      silenceLength += windowSize;
    } else {
      // End of silence
      if (silenceStart !== -1 && silenceLength >= minSilenceSamples) {
        // Mark the middle of the silence as split point
        const splitPoint = silenceStart + Math.floor(silenceLength / 2);
        silencePositions.push(splitPoint);
      }
      silenceStart = -1;
      silenceLength = 0;
    }
  }

  return silencePositions;
}

/**
 * Split base64-encoded PCM audio into segments using silence detection.
 *
 * Uses a multi-pass approach: first attempts to find natural silence gaps,
 * then falls back to time-based splitting if insufficient gaps are found.
 */
export function splitAudioBySilence(
  pcmBase64: string,
  expectedCount: number,
  sampleRate: number = 24000
): SplitAudioResult {
  const samples = pcmBase64ToSamples(pcmBase64);

  // Find silence positions
  const silencePositions = findSilenceSegments(samples, sampleRate);

  // If we found fewer splits than expected, try with lower threshold
  let splitPositions = silencePositions;
  if (silencePositions.length < expectedCount - 1) {
    // Try with more sensitive detection
    splitPositions = findSilenceSegments(samples, sampleRate, 1.5, 300);
  }

  // If still not enough, fall back to equal time divisions
  if (splitPositions.length < expectedCount - 1) {
    console.warn(
      `Only found ${splitPositions.length} silence gaps, expected ${expectedCount - 1}. Using time-based splitting.`
    );
    splitPositions = [];
    const segmentSize = Math.floor(samples.length / expectedCount);
    for (let i = 1; i < expectedCount; i++) {
      splitPositions.push(i * segmentSize);
    }
  }

  // Sort split positions
  splitPositions.sort((a, b) => a - b);

  // Take only the first (expectedCount - 1) splits
  splitPositions = splitPositions.slice(0, expectedCount - 1);

  // Create segments
  const segments: string[] = [];
  let lastPosition = 0;

  for (const splitPos of splitPositions) {
    const segment = samples.slice(lastPosition, splitPos);
    segments.push(samplesToPcmBase64(segment));
    lastPosition = splitPos;
  }

  // Add final segment
  const finalSegment = samples.slice(lastPosition);
  segments.push(samplesToPcmBase64(finalSegment));

  return {
    segments,
    count: segments.length,
  };
}

/**
 * Browser wrapper for `splitAudioBySilence`.
 */
export function splitAudioBySilenceBrowser(
  pcmBase64: string,
  expectedCount: number,
  sampleRate: number = 24000
): SplitAudioResult {
  return splitAudioBySilence(pcmBase64, expectedCount, sampleRate);
}
