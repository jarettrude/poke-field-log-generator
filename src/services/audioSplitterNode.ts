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

function chooseSplitPointsNearBoundaries(
  candidates: SilenceCandidate[],
  expectedSplits: number,
  totalSamples: number,
  sampleRate: number
): number[] {
  if (expectedSplits <= 0) return [];
  if (candidates.length === 0) return [];

  // Calculate ideal split boundaries (evenly spaced)
  const idealSpacing = totalSamples / (expectedSplits + 1);
  const idealBoundaries: number[] = [];
  for (let i = 1; i <= expectedSplits; i++) {
    idealBoundaries.push(Math.floor(i * idealSpacing));
  }

  // Sort candidates by start time for efficient searching
  const sortedCandidates = [...candidates].sort((a, b) => a.startSample - b.startSample);

  const selected: number[] = [];
  const usedCandidates = new Set<number>();
  const minDistanceSamples = Math.floor(sampleRate * 0.3); // 300ms minimum gap

  // For each ideal boundary, find the best nearby unused silence
  for (const idealPoint of idealBoundaries) {
    // Find candidates near this boundary, prefer longer silences
    const nearbyCandidates = sortedCandidates
      .map((c, idx) => ({ candidate: c, idx, distance: Math.abs(c.midSample - idealPoint) }))
      .filter(({ idx, distance }) => !usedCandidates.has(idx) && distance < idealSpacing * 0.8)
      .sort((a, b) => {
        // Prefer candidates closer to ideal point, then longer duration
        const distanceWeight = 0.001; // Small weight for distance
        return (a.distance * distanceWeight + 1 / a.candidate.durationSamples) -
               (b.distance * distanceWeight + 1 / b.candidate.durationSamples);
      });

    let bestCandidate: { candidate: SilenceCandidate; idx: number } | null = null;

    for (const { candidate, idx } of nearbyCandidates) {
      // Check distance from already selected points
      const tooClose = selected.some(s => Math.abs(s - candidate.midSample) < minDistanceSamples);
      if (!tooClose) {
        bestCandidate = { candidate, idx };
        break;
      }
    }

    if (bestCandidate) {
      selected.push(bestCandidate.candidate.midSample);
      usedCandidates.add(bestCandidate.idx);
    }
  }

  selected.sort((a, b) => a - b);
  return selected;
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
    minSilenceSeconds: 1.2,
    windowMs,
    enterSilenceRms: 80,
    exitSilenceRms: 150,
  });

  let splitPoints = chooseSplitPointsNearBoundaries(pass1, expectedSplits, samples.length, sampleRate);

  if (splitPoints.length < expectedSplits) {
    const pass2 = findSilenceCandidates({
      samples,
      sampleRate,
      minSilenceSeconds: 0.8,
      windowMs,
      enterSilenceRms: 50,
      exitSilenceRms: 100,
    });
    splitPoints = chooseSplitPointsNearBoundaries(pass2, expectedSplits, samples.length, sampleRate);
  }

  if (splitPoints.length < expectedSplits) {
    const base = timeBasedSplitPoints(samples.length, expectedSplits);
    const windowSamples = Math.max(1, Math.floor((sampleRate * windowMs) / 1000));
    splitPoints = base.map(p => snapToLowEnergy(samples, p, windowSamples));
  }

  splitPoints = splitPoints.slice(0, expectedSplits).sort((a, b) => a - b);

  // If we still don't have enough splits, use time-based to fill gaps
  if (splitPoints.length < expectedSplits) {
    const base = timeBasedSplitPoints(samples.length, expectedSplits);
    const existing = new Set(splitPoints);
    for (const point of base) {
      if (splitPoints.length >= expectedSplits) break;
      // Check if too close to existing
      const tooClose = splitPoints.some(s => Math.abs(s - point) < sampleRate * 0.3);
      if (!tooClose && !existing.has(point)) {
        splitPoints.push(point);
      }
    }
    splitPoints.sort((a, b) => a - b);
  }

  const buffers = splitBufferBySamplePoints(pcmBuffer, splitPoints);
  const segments = buffers.map(bufferToPcmBase64);

  // Guarantee exactly expectedCount segments
  if (segments.length !== expectedCount) {
    console.warn(
      `Audio split produced ${segments.length} segments, expected ${expectedCount}. ` +
      `Split points: ${splitPoints.length}`
    );
    // Pad with empty buffers or redistribute if needed
    while (segments.length < expectedCount) {
      segments.push(bufferToPcmBase64(Buffer.alloc(0)));
    }
    // Truncate if too many
    while (segments.length > expectedCount) {
      const last = segments.pop();
      if (last && segments.length > 0) {
        // Merge last two segments
        const prev = segments[segments.length - 1];
        if (prev) {
          const merged = Buffer.concat([Buffer.from(prev, 'base64'), Buffer.from(last, 'base64')]);
          segments[segments.length - 1] = merged.toString('base64');
        }
      }
    }
  }

  return { segments, count: segments.length };
}
