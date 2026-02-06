/**
 * Pokemon Service with caching via API
 * Fetches from PokeAPI and caches to SQLite via backend
 */

import { PokemonDetails, PokemonBaseInfo, PokemonSprites, VariantCategory } from '../types';

const BASE_URL = 'https://pokeapi.co/api/v2';
const API_BASE = '/api';

interface GenerationListResponse {
  results: Array<{ name: string; url: string }>;
}

interface GenerationDetailResponse {
  id: number;
  main_region: {
    name: string;
    url: string;
  };
}

function capitalizeRegion(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

interface PokemonSpeciesResponse {
  id: number;
  name: string;
  pokemon_species: Array<{ name: string; url: string }>;
  varieties?: Array<{
    is_default: boolean;
    pokemon: { name: string; url: string };
  }>;
}

interface PokemonResponse {
  id: number;
  name: string;
  height: number;
  weight: number;
  species: { url: string };
  sprites: PokemonSprites;
  types: Array<{ type: { name: string } }>;
  moves: Array<{ move: { name: string } }>;
}

interface SpeciesResponse {
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
}

interface FormResponse {
  id: number;
  name: string;
  form_name: string;
  is_mega: boolean;
  is_battle_only: boolean;
  is_default: boolean;
}

// ============================================================================
// Dynamic Region/Category Detection
// ============================================================================

// Cache for region names fetched from PokeAPI
let cachedRegionNames: string[] | null = null;

/**
 * Fetch all region names from PokeAPI dynamically.
 * Used to detect regional forms without hardcoding region names.
 */
export async function getRegionNames(): Promise<string[]> {
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
 * Categorize a Pokemon form DYNAMICALLY using PokeAPI data.
 *
 * Detection logic:
 * 1. is_mega flag from /pokemon-form/ endpoint → 'mega'
 * 2. form_name matches a region from /region endpoint → 'regional'
 * 3. form_name === 'gmax' → 'gmax' (PokeAPI naming convention)
 * 4. Everything else → 'other'
 */
export async function categorizeVariant(
  formName: string | null,
  isMega: boolean
): Promise<{ category: VariantCategory; regionName: string | null }> {
  if (!formName) return { category: 'default', regionName: null };

  // Check for Mega (using API flag)
  if (isMega) return { category: 'mega', regionName: null };

  // Check for Gigantamax (PokeAPI naming convention)
  if (formName === 'gmax') return { category: 'gmax', regionName: null };

  // Check for regional forms by matching against dynamic region list
  const regions = await getRegionNames();
  for (const region of regions) {
    if (formName.includes(region)) {
      // Capitalize region name for display
      const regionName = region.charAt(0).toUpperCase() + region.slice(1);
      return { category: 'regional', regionName };
    }
  }

  // Fallback for other forms (Totem, Primal, Origin, etc.)
  return { category: 'other', regionName: null };
}

/**
 * Format a variant name for display.
 * Dynamically constructs display name based on variant category.
 */
export function formatDisplayName(
  name: string,
  formName: string | null,
  category: VariantCategory,
  regionName?: string | null
): string {
  const baseName = name.split('-')[0] || name;
  const capitalizedBase = baseName.charAt(0).toUpperCase() + baseName.slice(1);

  if (!formName || category === 'default') return capitalizedBase;

  // Regional forms: Use dynamically detected region name
  if (category === 'regional' && regionName) {
    // "Alola" → "Alolan", "Galar" → "Galarian", etc.
    const adjective = regionName.endsWith('a')
      ? regionName.slice(0, -1) + 'n' // Alola → Alolan
      : regionName + 'ian'; // Hisui → Hisuian
    return `${adjective} ${capitalizedBase}`;
  }

  // Mega evolutions: "Mega Charizard X"
  if (category === 'mega') {
    const suffix = formName.replace('mega', '').replace(/-/g, ' ').trim().toUpperCase();
    return `Mega ${capitalizedBase}${suffix ? ' ' + suffix : ''}`;
  }

  // Gigantamax: "Gigantamax Charizard"
  if (category === 'gmax') return `Gigantamax ${capitalizedBase}`;

  // Other forms: "Rotom (Heat)", "Lycanroc (Midnight)"
  const formSuffix = formName
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return `${capitalizedBase} (${formSuffix})`;
}

// ============================================================================
// Generation & Pokemon Fetching
// ============================================================================

/**
 * Fetch generation metadata and return the generation name plus region from PokeAPI.
 */
export const fetchGenerationWithRegion = async (
  genId: number
): Promise<{ name: string; region: string }> => {
  const res = await fetch(`${BASE_URL}/generation/${genId}`);
  if (!res.ok) {
    return { name: `Generation ${genId}`, region: 'Unknown' };
  }
  const data = (await res.json()) as GenerationDetailResponse;
  return {
    name: `Generation ${data.id}`,
    region: capitalizeRegion(data.main_region.name),
  };
};

/**
 * Fetch all available generations from PokeAPI.
 */
export const fetchGenerations = async () => {
  const res = await fetch(`${BASE_URL}/generation`);
  const data = (await res.json()) as GenerationListResponse;
  return data.results.map((g, index: number) => ({
    id: index + 1,
    name: g.name.replace('generation-', 'Generation ').toUpperCase(),
  }));
};

/**
 * Fetch the list of Pokémon species for a given generation, normalized into
 * `PokemonBaseInfo` entries sorted by national Pokédex id.
 * Only returns default (base) forms.
 */
export const fetchPokemonInGeneration = async (genId: number): Promise<PokemonBaseInfo[]> => {
  const res = await fetch(`${BASE_URL}/generation/${genId}`);
  const data = (await res.json()) as PokemonSpeciesResponse;

  const pokemonList = data.pokemon_species
    .map((p: { name: string; url: string }) => {
      const id = parseInt(p.url.split('/').filter(Boolean).pop()!);
      const name = p.name;
      return {
        id,
        name,
        url: `${BASE_URL}/pokemon/${id}`,
        displayName: name.charAt(0).toUpperCase() + name.slice(1),
        speciesId: id,
        isDefault: true,
        formName: null,
        variantCategory: 'default' as VariantCategory,
        regionName: undefined,
      };
    })
    .sort((a, b) => a.id - b.id);

  return pokemonList;
};

/**
 * Fetch all variants for Pokemon in a generation.
 * Returns variants EXCLUDING default forms (those are in fetchPokemonInGeneration).
 */
export async function fetchVariantsForGeneration(genId: number): Promise<PokemonBaseInfo[]> {
  const basePokemon = await fetchPokemonInGeneration(genId);
  const variants: PokemonBaseInfo[] = [];

  for (const pokemon of basePokemon) {
    const speciesRes = await fetch(`${BASE_URL}/pokemon-species/${pokemon.id}`);
    if (!speciesRes.ok) continue;

    const speciesData = (await speciesRes.json()) as SpeciesResponse;

    for (const variety of speciesData.varieties) {
      if (variety.is_default) continue; // Skip base forms

      const variantId = parseInt(variety.pokemon.url.split('/').filter(Boolean).pop()!);
      const variantName = variety.pokemon.name;
      const formName = variantName.replace(`${speciesData.name}-`, '') || null;

      // Fetch form data for is_mega flag
      let isMega = false;
      try {
        const formRes = await fetch(`${BASE_URL}/pokemon-form/${variantName}`);
        if (formRes.ok) {
          const formData = (await formRes.json()) as FormResponse;
          isMega = formData.is_mega;
        }
      } catch {
        // Form endpoint might not exist for all variants
      }

      const { category, regionName } = await categorizeVariant(formName, isMega);
      const displayName = formatDisplayName(variantName, formName, category, regionName);

      variants.push({
        id: variantId,
        name: variantName,
        displayName,
        url: variety.pokemon.url,
        speciesId: pokemon.id,
        isDefault: false,
        formName,
        variantCategory: category,
        regionName: regionName || undefined,
      });
    }
  }

  return variants.sort((a, b) => a.speciesId - b.speciesId);
}

/**
 * Fetch variants by category for a specific generation (fast) or all generations (slow).
 * @param categories - Array of variant categories to include
 * @param genId - Optional generation ID to limit scope (highly recommended for performance)
 */
export async function fetchVariantsByCategory(
  categories: VariantCategory[],
  genId?: number
): Promise<PokemonBaseInfo[]> {
  // If a specific generation is provided, only fetch from that generation (fast)
  if (genId !== undefined) {
    const variants = await fetchVariantsForGeneration(genId);
    return variants
      .filter(v => categories.includes(v.variantCategory))
      .sort((a, b) => a.speciesId - b.speciesId);
  }

  // Otherwise, fetch from all generations (slow - not recommended)
  const generations = await fetchGenerations();
  const allVariants: PokemonBaseInfo[] = [];

  for (const gen of generations) {
    try {
      const variants = await fetchVariantsForGeneration(gen.id);
      const filtered = variants.filter(v => categories.includes(v.variantCategory));
      allVariants.push(...filtered);
    } catch (error) {
      console.error(`Failed to fetch variants for generation ${gen.id}:`, error);
    }
  }

  return allVariants.sort((a, b) => a.speciesId - b.speciesId);
}

/**
 * Get variant category counts across all generations.
 * Returns counts for mega, regional, gmax, and other categories.
 */
export async function getVariantCategoryCounts(): Promise<Record<VariantCategory, number>> {
  const counts: Record<VariantCategory, number> = {
    default: 0,
    mega: 0,
    regional: 0,
    gmax: 0,
    other: 0,
  };

  const generations = await fetchGenerations();

  for (const gen of generations) {
    try {
      const variants = await fetchVariantsForGeneration(gen.id);
      for (const variant of variants) {
        counts[variant.variantCategory]++;
      }
    } catch (error) {
      console.error(`Failed to count variants for generation ${gen.id}:`, error);
    }
  }

  return counts;
}

// ============================================================================
// Pokemon Details Fetching with Variant Support
// ============================================================================

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
  displayName: string;
  height: number;
  weight: number;
  types: string[];
  habitat: string;
  flavorTexts: string[];
  moveNames: string[];
  imagePngPath: string | null;
  imageSvgPath: string | null;
  generationId: number;
  region: string;
  speciesId: number;
  isDefault: boolean;
  formName: string | null;
  variantCategory: VariantCategory;
  regionName: string | null;
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
      displayName: cachedData.displayName,
      height: cachedData.height,
      weight: cachedData.weight,
      types: cachedData.types,
      imagePng: cachedData.imagePngPath,
      imageSvg: cachedData.imageSvgPath,
      flavorTexts: cachedData.flavorTexts,
      allMoveNames: cachedData.moveNames,
      habitat: cachedData.habitat,
      generationId: cachedData.generationId,
      region: cachedData.region,
      speciesId: cachedData.speciesId,
      isDefault: cachedData.isDefault,
      formName: cachedData.formName,
      variantCategory: cachedData.variantCategory,
      regionName: cachedData.regionName || undefined,
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

  const imagePngUrl = pokemonData.sprites.other['official-artwork'].front_default;
  const imageSvgUrl = pokemonData.sprites.other['dream_world'].front_default;

  // Extract generation ID from the generation URL
  const generationId = parseInt(speciesData.generation.url.split('/').filter(Boolean).pop()!, 10);

  // Fetch region name from generation endpoint
  const generationRes = await fetch(speciesData.generation.url);
  let region = 'Unknown';
  if (generationRes.ok) {
    const generationData = (await generationRes.json()) as GenerationDetailResponse;
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

    // Fetch form data for is_mega
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

  // Cache to database (images will be downloaded by backend)
  const saveResponse = await fetch(`${API_BASE}/pokemon/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: pokemonData.name,
      displayName,
      height: pokemonData.height,
      weight: pokemonData.weight,
      types: pokemonData.types.map(t => t.type.name),
      habitat: speciesData.habitat?.name || 'the unknown wild',
      flavorTexts: Array.from(new Set(flavorTexts)),
      moveNames: pokemonData.moves.map(m => m.move.name.replace(/-/g, ' ')),
      imagePngUrl,
      imageSvgUrl,
      generationId,
      region,
      speciesId,
      isDefault,
      formName,
      variantCategory,
      regionName,
    }),
  });

  await handleResponse(saveResponse);

  // Fetch again to get local image paths
  const freshCached = await fetch(`${API_BASE}/pokemon/${id}`);
  const freshData = await handleResponse<CachedPokemonResponse>(freshCached);

  // Fallback to URL if freshData is null
  return {
    id: pokemonData.id,
    name: pokemonData.name,
    displayName,
    height: pokemonData.height,
    weight: pokemonData.weight,
    types: pokemonData.types.map(t => t.type.name),
    imagePng: freshData?.imagePngPath || imagePngUrl,
    imageSvg: freshData?.imageSvgPath || imageSvgUrl,
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
};
