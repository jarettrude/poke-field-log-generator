/**
 * Pokemon Service with caching via API
 * Fetches from PokeAPI and caches to SQLite via backend
 */

import { PokemonDetails, PokemonBaseInfo } from '../types';

const BASE_URL = 'https://pokeapi.co/api/v2';
const API_BASE = '/api';

// Region mapping for each generation
const GENERATION_REGIONS: Record<number, string> = {
  1: 'Kanto',
  2: 'Johto',
  3: 'Hoenn',
  4: 'Sinnoh',
  5: 'Unova',
  6: 'Kalos',
  7: 'Alola',
  8: 'Galar',
  9: 'Paldea',
};

/**
 * Fetches generation info including the main region name
 */
interface GenerationResponse {
  results: Array<{ name: string; url: string }>;
}

interface PokemonSpeciesResponse {
  pokemon_species: Array<{ name: string; url: string }>;
}

interface PokemonResponse {
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
}

interface SpeciesResponse {
  habitat: { name: string } | null;
  flavor_text_entries: Array<{
    flavor_text: string;
    language: { name: string };
  }>;
}

/**
 * Fetch generation metadata and return the generation name plus a best-effort
 * mapping to a canonical region label.
 */
export const fetchGenerationWithRegion = async (
  genId: number
): Promise<{ name: string; region: string }> => {
  const gen = await fetchGenerations();
  const genInfo = gen.find((g: { id: number; name: string }) => g.id === genId);
  return {
    name: genInfo?.name || `Generation ${genId}`,
    region: GENERATION_REGIONS[genId] || 'Unknown Region',
  };
};

/**
 * Fetch all available generations from PokeAPI.
 */
export const fetchGenerations = async () => {
  const res = await fetch(`${BASE_URL}/generation`);
  const data = (await res.json()) as GenerationResponse;
  return data.results.map((g, index: number) => ({
    id: index + 1,
    name: g.name.replace('generation-', 'Generation ').toUpperCase(),
  }));
};

/**
 * Fetch the list of Pokémon species for a given generation, normalized into
 * `PokemonBaseInfo` entries sorted by national Pokédex id.
 */
export const fetchPokemonInGeneration = async (genId: number): Promise<PokemonBaseInfo[]> => {
  const res = await fetch(`${BASE_URL}/generation/${genId}`);
  const data = (await res.json()) as PokemonSpeciesResponse;

  const pokemonList = data.pokemon_species
    .map((p: { name: string; url: string }) => {
      const id = parseInt(p.url.split('/').filter(Boolean).pop()!);
      return {
        id,
        name: p.name,
        url: `${BASE_URL}/pokemon/${id}`,
      };
    })
    .sort((a: PokemonBaseInfo, b: PokemonBaseInfo) => a.id - b.id);

  return pokemonList;
};

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function handleResponse<T>(response: Response): Promise<T | null> {
  const result = (await response.json()) as ApiResponse<T>;
  
  if (!result.success) {
    throw new Error(result.error || 'Unknown API error');
  }
  
  return result.data ?? null;
}

interface CachedPokemonResponse {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: string[];
  habitat: string;
  flavorTexts: string[];
  moveNames: string[];
  imagePngPath: string | null;
  imageSvgPath: string | null;
}

/**
 * Fetch detailed Pokémon data.
 *
 * This first attempts to read from the local cache via `/api/pokemon/[id]`. If
 * not cached, it fetches from PokeAPI and then POSTs back to the cache endpoint
 * (which also downloads sprite assets into `public/pokemon/`).
 */
export const fetchPokemonDetails = async (id: number): Promise<PokemonDetails> => {
  // First check if cached in database
  const cachedResponse = await fetch(`${API_BASE}/pokemon/${id}`);
  const cachedData = await handleResponse<CachedPokemonResponse>(cachedResponse);

  if (cachedData) {
    // Return cached data with local image paths
    return {
      id: cachedData.id,
      name: cachedData.name,
      height: cachedData.height,
      weight: cachedData.weight,
      types: cachedData.types,
      imagePng: cachedData.imagePngPath,
      imageSvg: cachedData.imageSvgPath,
      flavorTexts: cachedData.flavorTexts,
      allMoveNames: cachedData.moveNames,
      habitat: cachedData.habitat,
    };
  }

  // Not cached, fetch from PokeAPI
  const pokemonRes = await fetch(`${BASE_URL}/pokemon/${id}`);
  const pokemonData = (await pokemonRes.json()) as PokemonResponse;

  const speciesRes = await fetch(pokemonData.species.url);
  const speciesData = (await speciesRes.json()) as SpeciesResponse;

  const flavorTexts = speciesData.flavor_text_entries
    .filter((entry: { language: { name: string } }) => entry.language.name === 'en')
    .map((entry: { flavor_text: string }) => entry.flavor_text.replace(/[\n\f]/g, ' '));

  const imagePngUrl = pokemonData.sprites.front_default;
  const imageSvgUrl = pokemonData.sprites.other.dream_world.front_default;

  // Cache to database (images will be downloaded by backend)
  const saveResponse = await fetch(`${API_BASE}/pokemon/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: pokemonData.name,
      height: pokemonData.height,
      weight: pokemonData.weight,
      types: pokemonData.types.map(t => t.type.name),
      habitat: speciesData.habitat?.name || 'the unknown wild',
      flavorTexts: Array.from(new Set(flavorTexts)),
      moveNames: pokemonData.moves.map(m => m.move.name.replace(/-/g, ' ')),
      imagePngUrl,
      imageSvgUrl,
    }),
  });
  
  await handleResponse(saveResponse);

  // Fetch again to get local image paths
  const freshCached = await fetch(`${API_BASE}/pokemon/${id}`);
  const freshData = await handleResponse<CachedPokemonResponse>(freshCached);

  // Fallback to URL if freshData is null (shouldn't happen after save, but for safety)
  return {
    id: pokemonData.id,
    name: pokemonData.name,
    height: pokemonData.height,
    weight: pokemonData.weight,
    types: pokemonData.types.map(t => t.type.name),
    imagePng: freshData?.imagePngPath || imagePngUrl,
    imageSvg: freshData?.imageSvgPath || imageSvgUrl,
    flavorTexts: Array.from(new Set(flavorTexts)),
    allMoveNames: pokemonData.moves.map(m => m.move.name.replace(/-/g, ' ')),
    habitat: speciesData.habitat?.name || 'the unknown wild',
  };
};
