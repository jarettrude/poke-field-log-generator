import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const POKEMON_IMAGE_DIR = path.join(process.cwd(), 'public', 'pokemon');
const MAX_THUMB_DIMENSION = 16;

/**
 * Attempt to read a file, returning its buffer or null if it doesn't exist.
 */
async function tryReadFile(filePath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

/**
 * GET /api/pokemon/[id]/thumb
 *
 * Returns a max-16px PNG thumbnail for the Pokémon. Prefers SVG source
 * (rasterised via sharp) for best quality at small sizes, falling back
 * to the main PNG. Preserves alpha channel.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const pokemonId = parseInt(id, 10);
    if (isNaN(pokemonId) || pokemonId < 1) {
      return new Response('Invalid Pokémon id', { status: 400 });
    }

    // Prefer SVG (vector → crisp at tiny sizes), fall back to PNG
    const svgBuffer = await tryReadFile(path.join(POKEMON_IMAGE_DIR, `${pokemonId}.svg`));
    const pngBuffer = svgBuffer
      ? null
      : await tryReadFile(path.join(POKEMON_IMAGE_DIR, `${pokemonId}.png`));
    const inputBuffer = svgBuffer ?? pngBuffer;

    if (!inputBuffer) {
      return new Response('No image found', { status: 404 });
    }

    const thumbBuffer = await sharp(inputBuffer, svgBuffer ? { density: 72 } : undefined)
      .resize({
        width: MAX_THUMB_DIMENSION,
        height: MAX_THUMB_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    return new Response(new Uint8Array(thumbBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return new Response('Failed to generate thumbnail', { status: 500 });
  }
}
