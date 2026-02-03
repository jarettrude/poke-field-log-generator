/**
 * Server-side Pokémon data fetching with local caching and sprite downloads.
 */

import fs from 'fs/promises';
import path from 'path';
import { getDatabase } from '@/lib/db/adapter';
import type { PokemonDetails } from '@/types';

const BASE_URL = 'https://pokeapi.co/api/v2';
const POKEMON_IMAGE_DIR = path.join(process.cwd(), 'public', 'pokemon');

type PokemonResponse = {
  id: number;
  name: string;
  height: number;
  weight: number;
  species: { url: string };
  sprites: {
    front_default: string | null;
    other: {
      dream_world: {
        front_default: string | null;
      };
    };
  };
  types: Array<{ type: { name: string } }>;
  moves: Array<{ move: { name: string } }>;
};

type SpeciesResponse = {
  habitat: { name: string } | null;
  flavor_text_entries: Array<{
    flavor_text: string;
    language: { name: string };
  }>;
};

/**
 * Download PNG and SVG sprites to public/pokemon/ and return local paths.
 */
async function downloadSpriteAssets(params: {
  pokemonId: number;
  imagePngUrl: string | null;
  imageSvgUrl: string | null;
}): Promise<{ imagePngPath: string | null; imageSvgPath: string | null }> {
  const { pokemonId, imagePngUrl, imageSvgUrl } = params;

  let imagePngPath: string | null = null;
  let imageSvgPath: string | null = null;

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

  return { imagePngPath, imageSvgPath };
}

/**
 * Fetch Pokémon details from cache or PokeAPI, downloading sprites if needed.
 */
export async function getOrFetchPokemonDetailsServer(id: number): Promise<PokemonDetails> {
  const db = await getDatabase();
  const cached = await db.getCachedPokemon(id);
  if (cached) {
    return {
      id: cached.id,
      name: cached.name,
      height: cached.height,
      weight: cached.weight,
      types: cached.types,
      imagePng: cached.imagePngPath,
      imageSvg: cached.imageSvgPath,
      flavorTexts: cached.flavorTexts,
      allMoveNames: cached.moveNames,
      habitat: cached.habitat,
    };
  }

  const pokemonRes = await fetch(`${BASE_URL}/pokemon/${id}`);
  if (!pokemonRes.ok) {
    throw new Error(`Failed to fetch pokemon ${id} from PokeAPI`);
  }
  const pokemonData = (await pokemonRes.json()) as PokemonResponse;

  const speciesRes = await fetch(pokemonData.species.url);
  if (!speciesRes.ok) {
    throw new Error(`Failed to fetch pokemon species ${id} from PokeAPI`);
  }
  const speciesData = (await speciesRes.json()) as SpeciesResponse;

  const flavorTexts = speciesData.flavor_text_entries
    .filter(entry => entry.language.name === 'en')
    .map(entry => entry.flavor_text.replace(/[\n\f]/g, ' '));

  const imagePngUrl = pokemonData.sprites.front_default;
  const imageSvgUrl = pokemonData.sprites.other.dream_world.front_default;

  const { imagePngPath, imageSvgPath } = await downloadSpriteAssets({
    pokemonId: id,
    imagePngUrl,
    imageSvgUrl,
  });

  await db.cachePokemon({
    id: pokemonData.id,
    name: pokemonData.name,
    height: pokemonData.height,
    weight: pokemonData.weight,
    types: pokemonData.types.map(t => t.type.name),
    habitat: speciesData.habitat?.name || 'the unknown wild',
    flavorTexts: Array.from(new Set(flavorTexts)),
    moveNames: pokemonData.moves.map(m => m.move.name.replace(/-/g, ' ')),
    imagePngPath,
    imageSvgPath,
  });

  return {
    id: pokemonData.id,
    name: pokemonData.name,
    height: pokemonData.height,
    weight: pokemonData.weight,
    types: pokemonData.types.map(t => t.type.name),
    imagePng: imagePngPath || imagePngUrl,
    imageSvg: imageSvgPath || imageSvgUrl,
    flavorTexts: Array.from(new Set(flavorTexts)),
    allMoveNames: pokemonData.moves.map(m => m.move.name.replace(/-/g, ' ')),
    habitat: speciesData.habitat?.name || 'the unknown wild',
  };
}
