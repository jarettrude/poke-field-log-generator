import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { getDatabase } from '@/lib/db/adapter';
import { errorResponse, parseId } from '@/lib/server/api';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const AUDIO_CONTENT_TYPE = 'audio/mpeg';

/**
 * GET /api/audio/[id]/file
 *
 * Streams the stored MP3 file for an audio log. Supports HTTP Range requests
 * so clients can seek without downloading the whole clip.
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const audioId = parseId(id);
    if (!audioId) {
      return errorResponse('Invalid ID', 400);
    }

    const db = await getDatabase();
    const filePath = await db.getAudioFilePath(audioId);
    if (!filePath) {
      return errorResponse('Audio file not found', 404);
    }

    const { size } = await fs.stat(filePath);
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');

    if (range) {
      const start = range[1] ? Number.parseInt(range[1], 10) : 0;
      const end = range[2] ? Math.min(Number.parseInt(range[2], 10), size - 1) : size - 1;
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
        return new Response(null, { status: 416 });
      }
      const stream = createReadStream(filePath, { start, end });
      return new Response(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          'Content-Type': AUDIO_CONTENT_TYPE,
          'Accept-Ranges': 'bytes',
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Content-Length': String(end - start + 1),
        },
      });
    }

    const stream = createReadStream(filePath);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': AUDIO_CONTENT_TYPE,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(size),
      },
    });
  } catch (error) {
    console.error('Error streaming audio file:', error);
    return errorResponse('Failed to stream audio file', 500);
  }
}
