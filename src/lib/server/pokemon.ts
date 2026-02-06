/**
 * Server-side Pokémon data fetching with local caching and sprite downloads.
 */

import fs from 'fs/promises';
import path from 'path';
import { getDatabase } from '@/lib/db/adapter';
import { PokemonDetails, PokemonSprites, VariantCategory } from '../../types';

const BASE_URL = 'https://pokeapi.co/api/v2';
const POKEMON_IMAGE_DIR = path.join(process.cwd(), 'public', 'pokemon');

type PokemonResponse = {
  id: number;
  name: string;
  height: number;
  weight: number;
  species: { url: string };
  sprites: PokemonSprites;
  types: Array<{ type: { name: string } }>;
  moves: Array<{ move: { name: string } }>;
};

type SpeciesResponse = {
  id: number;
  name: string;
  habitat: { name: string } | null;
  flavor_text_entries: Array<{
    flavor_text: string;
    language: { name: string };
  }>;
  generation: {
    name: string;
    url: string;
  };
  varieties: Array<{
    is_default: boolean;
    pokemon: { name: string; url: string };
  }>;
};

type GenerationResponse = {
  id: number;
  main_region: {
    name: string;
    url: string;
  };
};

type FormResponse = {
  id: number;
  name: string;
  form_name: string;
  is_mega: boolean;
  is_battle_only: boolean;
  is_default: boolean;
};

// Cache for region names fetched from PokeAPI
let cachedRegionNames: string[] | null = null;

function capitalizeRegion(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Fetch all region names from PokeAPI dynamically.
 */
async function getRegionNames(): Promise<string[]> {
  if (cachedRegionNames) return cachedRegionNames;

  const res = await fetch(`${BASE_URL}/region`);
  if (!res.ok) {
    console.warn('Failed to fetch regions, using empty list');
    return [];
  }

  const data = (await res.json()) as { results: Array<{ name: string }> };
  cachedRegionNames = data.results.map(r => r.name);
  return cachedRegionNames;
}

/**
 * Categorize a Pokemon form dynamically.
 */
async function categorizeVariant(
  formName: string | null,
  isMega: boolean
): Promise<{ category: VariantCategory; regionName: string | null }> {
  if (!formName) return { category: 'default', regionName: null };

  if (isMega) return { category: 'mega', regionName: null };
  if (formName === 'gmax') return { category: 'gmax', regionName: null };

  const regions = await getRegionNames();
  for (const region of regions) {
    if (formName.includes(region)) {
      const regionName = region.charAt(0).toUpperCase() + region.slice(1);
      return { category: 'regional', regionName };
    }
  }

  return { category: 'other', regionName: null };
}

/**
 * Format a variant name for display.
 */
function formatDisplayName(
  name: string,
  formName: string | null,
  category: VariantCategory,
  regionName?: string | null
): string {
  const baseName = name.split('-')[0] || name;
  const capitalizedBase = baseName.charAt(0).toUpperCase() + baseName.slice(1);

  if (!formName || category === 'default') return capitalizedBase;

  if (category === 'regional' && regionName) {
    const adjective = regionName.endsWith('a') ? regionName.slice(0, -1) + 'n' : regionName + 'ian';
    return `${adjective} ${capitalizedBase}`;
  }

  if (category === 'mega') {
    const suffix = formName.replace('mega', '').replace(/-/g, ' ').trim().toUpperCase();
    return `Mega ${capitalizedBase}${suffix ? ' ' + suffix : ''}`;
  }

  if (category === 'gmax') return `Gigantamax ${capitalizedBase}`;

  const formSuffix = formName
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return `${capitalizedBase} (${formSuffix})`;
}

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
      displayName: cached.displayName,
      height: cached.height,
      weight: cached.weight,
      types: cached.types,
      imagePng: cached.imagePngPath,
      imageSvg: cached.imageSvgPath,
      flavorTexts: cached.flavorTexts,
      allMoveNames: cached.moveNames,
      habitat: cached.habitat,
      generationId: cached.generationId,
      region: cached.region,
      speciesId: cached.speciesId,
      isDefault: cached.isDefault,
      formName: cached.formName,
      variantCategory: cached.variantCategory,
      regionName: cached.regionName || undefined,
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

  const imagePngUrl = pokemonData.sprites.other['official-artwork'].front_default;
  const imageSvgUrl = pokemonData.sprites.other.dream_world.front_default;

  const { imagePngPath, imageSvgPath } = await downloadSpriteAssets({
    pokemonId: id,
    imagePngUrl,
    imageSvgUrl,
  });

  // Extract generation ID from the generation URL
  const generationId = parseInt(speciesData.generation.url.split('/').filter(Boolean).pop()!, 10);

  // Fetch region name from generation endpoint
  const generationRes = await fetch(speciesData.generation.url);
  let region = 'Unknown';
  if (generationRes.ok) {
    const generationData = (await generationRes.json()) as GenerationResponse;
    region = capitalizeRegion(generationData.main_region.name);
  }

  // Determine variant info
  const speciesId = speciesData.id;
  const isDefault =
    speciesData.varieties.find(
      v => parseInt(v.pokemon.url.split('/').filter(Boolean).pop()!) === id
    )?.is_default ?? true;

  let formName: string | null = null;
  let isMega = false;

  if (!isDefault) {
    formName = pokemonData.name.replace(`${speciesData.name}-`, '') || null;

    try {
      const formRes = await fetch(`${BASE_URL}/pokemon-form/${pokemonData.name}`);
      if (formRes.ok) {
        const formData = (await formRes.json()) as FormResponse;
        isMega = formData.is_mega;
      }
    } catch {
      // Form endpoint might not exist
    }
  }

  const { category: variantCategory, regionName } = await categorizeVariant(formName, isMega);
  const displayName = formatDisplayName(pokemonData.name, formName, variantCategory, regionName);

  await db.cachePokemon({
    id: pokemonData.id,
    name: pokemonData.name,
    displayName,
    height: pokemonData.height,
    weight: pokemonData.weight,
    types: pokemonData.types.map(t => t.type.name),
    habitat: speciesData.habitat?.name || 'the unknown wild',
    flavorTexts: Array.from(new Set(flavorTexts)),
    moveNames: pokemonData.moves.map(m => m.move.name.replace(/-/g, ' ')),
    imagePngPath,
    imageSvgPath,
    generationId,
    region,
    speciesId,
    isDefault,
    formName,
    variantCategory,
    regionName,
  });

  return {
    id: pokemonData.id,
    name: pokemonData.name,
    displayName,
    height: pokemonData.height,
    weight: pokemonData.weight,
    types: pokemonData.types.map(t => t.type.name),
    imagePng: imagePngPath || imagePngUrl,
    imageSvg: imageSvgPath || imageSvgUrl,
    flavorTexts: Array.from(new Set(flavorTexts)),
    allMoveNames: pokemonData.moves.map(m => m.move.name.replace(/-/g, ' ')),
    habitat: speciesData.habitat?.name || 'the unknown wild',
    generationId,
    region,
    speciesId,
    isDefault,
    formName,
    variantCategory,
    regionName: regionName || undefined,
  };
}
