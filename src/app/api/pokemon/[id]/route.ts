import { getDatabase } from '@/lib/db/adapter';
import fs from 'fs/promises';
import path from 'path';
import { successResponse, errorResponse, parseId } from '@/lib/server/api';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const POKEMON_IMAGE_DIR = path.join(process.cwd(), 'public', 'pokemon');

/**
 * GET /api/pokemon/[id]
 *
 * Returns cached Pokémon details if present. Returns `null` if not cached so the
 * client can fall back to fetching from PokeAPI.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const pokemonId = parseId(id);
    if (!pokemonId) {
      return errorResponse('Invalid Pokémon id', 400);
    }

    const db = await getDatabase();
    const cached = await db.getCachedPokemon(pokemonId);

    if (cached) {
      return successResponse(cached);
    }

    // Not cached, return null to signal frontend should fetch from PokeAPI
    return successResponse(null);
  } catch (error) {
    console.error('Error fetching cached pokemon:', error);
    return errorResponse('Failed to fetch pokemon', 500);
  }
}

async function downloadImage(url: string | null, filename: string): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    await fs.writeFile(path.join(POKEMON_IMAGE_DIR, filename), Buffer.from(buffer));
    return `/pokemon/${filename}`;
  } catch (e) {
    console.warn(`Failed to download image from ${url}:`, e);
    return null;
  }
}

/**
 * POST /api/pokemon/[id]
 *
 * Caches Pokémon data in the database and stores sprite images under
 * `public/pokemon/` (when available).
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const pokemonId = parseId(id);
    if (!pokemonId) {
      return errorResponse('Invalid Pokémon id', 400);
    }

    const body = await request.json();

    const {
      name,
      height,
      weight,
      types,
      habitat,
      flavorTexts,
      moveNames,
      imagePngUrl,
      imageSvgUrl,
    } = body;

    if (
      typeof name !== 'string' ||
      typeof height !== 'number' ||
      typeof weight !== 'number' ||
      !Array.isArray(types) ||
      typeof habitat !== 'string' ||
      !Array.isArray(flavorTexts) ||
      !Array.isArray(moveNames)
    ) {
      return errorResponse('Invalid request body', 400);
    }

    // Ensure directory exists
    await fs.mkdir(POKEMON_IMAGE_DIR, { recursive: true });

    // Parallelize downloads
    const [imagePngPath, imageSvgPath] = await Promise.all([
      downloadImage(imagePngUrl, `${pokemonId}.png`),
      downloadImage(imageSvgUrl, `${pokemonId}.svg`),
    ]);

    const db = await getDatabase();
    await db.cachePokemon({
      id: pokemonId,
      name,
      height,
      weight,
      types,
      habitat,
      flavorTexts,
      moveNames,
      imagePngPath,
      imageSvgPath,
    });

    return successResponse({
      saved: true,
      imagePngPath,
      imageSvgPath,
    });
  } catch (error) {
    console.error('Error caching pokemon:', error);
    return errorResponse('Failed to cache pokemon', 500);
  }
}
