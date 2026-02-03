import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/adapter';
import fs from 'fs/promises';
import path from 'path';

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
    const pokemonId = Number.parseInt(id, 10);
    if (!Number.isFinite(pokemonId) || pokemonId <= 0) {
      return NextResponse.json({ error: 'Invalid Pokémon id' }, { status: 400 });
    }

    const db = await getDatabase();
    const cached = await db.getCachedPokemon(pokemonId);

    if (cached) {
      return NextResponse.json(cached);
    }

    // Not cached, return null to signal frontend should fetch from PokeAPI
    return NextResponse.json(null);
  } catch (error) {
    console.error('Error fetching cached pokemon:', error);
    return NextResponse.json({ error: 'Failed to fetch pokemon' }, { status: 500 });
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
    const pokemonId = Number.parseInt(id, 10);
    if (!Number.isFinite(pokemonId) || pokemonId <= 0) {
      return NextResponse.json({ error: 'Invalid Pokémon id' }, { status: 400 });
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
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Download and save images to public/pokemon/
    let imagePngPath: string | null = null;
    let imageSvgPath: string | null = null;

    // Ensure directory exists
    await fs.mkdir(POKEMON_IMAGE_DIR, { recursive: true });

    if (imagePngUrl) {
      try {
        const response = await fetch(imagePngUrl);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          const filename = `${pokemonId}.png`;
          await fs.writeFile(path.join(POKEMON_IMAGE_DIR, filename), Buffer.from(buffer));
          imagePngPath = `/pokemon/${filename}`;
        }
      } catch (e) {
        console.warn(`Failed to download PNG for pokemon ${pokemonId}:`, e);
      }
    }

    if (imageSvgUrl) {
      try {
        const response = await fetch(imageSvgUrl);
        if (response.ok) {
          const svgContent = await response.text();
          const filename = `${pokemonId}.svg`;
          await fs.writeFile(path.join(POKEMON_IMAGE_DIR, filename), svgContent);
          imageSvgPath = `/pokemon/${filename}`;
        }
      } catch (e) {
        console.warn(`Failed to download SVG for pokemon ${pokemonId}:`, e);
      }
    }

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

    return NextResponse.json({
      success: true,
      imagePngPath,
      imageSvgPath,
    });
  } catch (error) {
    console.error('Error caching pokemon:', error);
    return NextResponse.json({ error: 'Failed to cache pokemon' }, { status: 500 });
  }
}
