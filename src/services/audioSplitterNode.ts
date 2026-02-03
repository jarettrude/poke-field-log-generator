/**
 * Node.js audio splitter using silence detection to segment bulk TTS output.
 */

export interface SplitAudioResult {
  segments: string[];
  count: number;
}

type SilenceCandidate = {
  startSample: number;
  endSample: number;
  midSample: number;
  durationSamples: number;
  minRms: number;
};

function pcmBase64ToBuffer(pcmBase64: string): Buffer {
  return Buffer.from(pcmBase64, 'base64');
}

function bufferToPcmBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

function getInt16View(buffer: Buffer): Int16Array {
  return new Int16Array(buffer.buffer, buffer.byteOffset, Math.floor(buffer.byteLength / 2));
}

function windowRms(samples: Int16Array, startSample: number, windowSamples: number): number {
  const end = Math.min(startSample + windowSamples, samples.length);
  if (end <= startSample) return 0;

  let sumSquares = 0;
  for (let i = startSample; i < end; i++) {
    const s = samples[i] || 0;
    sumSquares += s * s;
  }

  return Math.sqrt(sumSquares / (end - startSample));
}

function findSilenceCandidates(params: {
  samples: Int16Array;
  sampleRate: number;
  minSilenceSeconds: number;
  windowMs: number;
  enterSilenceRms: number;
  exitSilenceRms: number;
}): SilenceCandidate[] {
  const { samples, sampleRate, minSilenceSeconds, windowMs, enterSilenceRms, exitSilenceRms } =
    params;

  const windowSamples = Math.max(1, Math.floor((sampleRate * windowMs) / 1000));
  const minSilenceSamples = Math.max(1, Math.floor(sampleRate * minSilenceSeconds));

  const candidates: SilenceCandidate[] = [];

  let runStart = -1;
  let runMinRms = Number.POSITIVE_INFINITY;

  for (let i = 0; i < samples.length; i += windowSamples) {
    const rms = windowRms(samples, i, windowSamples);

    if (runStart === -1) {
      if (rms < enterSilenceRms) {
        runStart = i;
        runMinRms = rms;
      }
      continue;
    }

    runMinRms = Math.min(runMinRms, rms);

    if (rms > exitSilenceRms) {
      const runEnd = i;
      const duration = runEnd - runStart;
      if (duration >= minSilenceSamples) {
        const mid = runStart + Math.floor(duration / 2);
        candidates.push({
          startSample: runStart,
          endSample: runEnd,
          midSample: mid,
          durationSamples: duration,
          minRms: runMinRms,
        });
      }
      runStart = -1;
      runMinRms = Number.POSITIVE_INFINITY;
    }
  }

  if (runStart !== -1) {
    const runEnd = samples.length;
    const duration = runEnd - runStart;
    if (duration >= minSilenceSamples) {
      const mid = runStart + Math.floor(duration / 2);
      candidates.push({
        startSample: runStart,
        endSample: runEnd,
        midSample: mid,
        durationSamples: duration,
        minRms: runMinRms,
      });
    }
  }

  return candidates;
}

function chooseSplitPoints(
  candidates: SilenceCandidate[],
  expectedSplits: number,
  sampleRate: number
): number[] {
  if (expectedSplits <= 0) return [];
  if (candidates.length === 0) return [];

  const scored = candidates
    .map(c => ({
      midSample: c.midSample,
      score: c.durationSamples * 10 + Math.max(0, 1500 - c.minRms),
    }))
    .sort((a, b) => b.score - a.score);

  const selected: number[] = [];
  const minDistanceSamples = Math.floor(sampleRate * 0.5);

  for (const item of scored) {
    if (selected.length >= expectedSplits) break;
    const tooClose = selected.some(s => Math.abs(s - item.midSample) < minDistanceSamples);
    if (!tooClose) selected.push(item.midSample);
  }

  selected.sort((a, b) => a - b);
  return selected.slice(0, expectedSplits);
}

function timeBasedSplitPoints(totalSamples: number, expectedSplits: number): number[] {
  if (expectedSplits <= 0) return [];
  const points: number[] = [];
  const segmentSize = Math.floor(totalSamples / (expectedSplits + 1));
  for (let i = 1; i <= expectedSplits; i++) {
    points.push(i * segmentSize);
  }
  return points;
}

function snapToLowEnergy(samples: Int16Array, point: number, windowSamples: number): number {
  const searchRadius = windowSamples * 10;
  const start = Math.max(0, point - searchRadius);
  const end = Math.min(samples.length, point + searchRadius);

  let bestPoint = point;
  let bestRms = Number.POSITIVE_INFINITY;

  for (let i = start; i < end; i += windowSamples) {
    const rms = windowRms(samples, i, windowSamples);
    if (rms < bestRms) {
      bestRms = rms;
      bestPoint = i;
    }
  }

  return bestPoint;
}

function splitBufferBySamplePoints(buffer: Buffer, splitPointsSamples: number[]): Buffer[] {
  const segments: Buffer[] = [];

  const alignSample = (sample: number) => {
    const aligned = Math.max(0, Math.floor(sample));
    return aligned;
  };

  const toByte = (sample: number) => {
    const byte = alignSample(sample) * 2;
    return byte - (byte % 2);
  };

  const pointsBytes = splitPointsSamples.map(toByte).filter(b => b > 0 && b < buffer.byteLength);
  pointsBytes.sort((a, b) => a - b);

  let last = 0;
  for (const p of pointsBytes) {
    segments.push(buffer.subarray(last, p));
    last = p;
  }
  segments.push(buffer.subarray(last));

  return segments;
}

/**
 * Split base64-encoded PCM audio into segments using silence detection.
 *
 * Uses a multi-pass approach: first attempts to find natural silence gaps,
 * then falls back to time-based splitting with low-energy snapping.
 */
export function splitAudioBySilenceNode(
  pcmBase64: string,
  expectedCount: number,
  sampleRate: number = 24000
): SplitAudioResult {
  if (expectedCount <= 0) {
    return { segments: [], count: 0 };
  }

  const pcmBuffer = pcmBase64ToBuffer(pcmBase64);
  const samples = getInt16View(pcmBuffer);

  const expectedSplits = Math.max(0, expectedCount - 1);
  const windowMs = 50;

  const pass1 = findSilenceCandidates({
    samples,
    sampleRate,
    minSilenceSeconds: 2.0,
    windowMs,
    enterSilenceRms: 500,
    exitSilenceRms: 800,
  });

  let splitPoints = chooseSplitPoints(pass1, expectedSplits, sampleRate);

  if (splitPoints.length < expectedSplits) {
    const pass2 = findSilenceCandidates({
      samples,
      sampleRate,
      minSilenceSeconds: 1.5,
      windowMs,
      enterSilenceRms: 350,
      exitSilenceRms: 650,
    });
    splitPoints = chooseSplitPoints(pass2, expectedSplits, sampleRate);
  }

  if (splitPoints.length < expectedSplits) {
    const base = timeBasedSplitPoints(samples.length, expectedSplits);
    const windowSamples = Math.max(1, Math.floor((sampleRate * windowMs) / 1000));
    splitPoints = base.map(p => snapToLowEnergy(samples, p, windowSamples));
  }

  splitPoints = splitPoints.slice(0, expectedSplits).sort((a, b) => a - b);

  const buffers = splitBufferBySamplePoints(pcmBuffer, splitPoints);
  const segments = buffers.map(bufferToPcmBase64);

  return { segments, count: segments.length };
}
