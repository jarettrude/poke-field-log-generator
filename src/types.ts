/**
 * Type definitions for the Pokédex Field Log Generator.
 * Includes interfaces for Pokemon data, jobs, processing, and UI state.
 */

/**
 * Variant category for filtering UI.
 * These are derived dynamically from PokeAPI data:
 * - 'mega' detected via is_mega flag from /pokemon-form/ endpoint
 * - 'regional' detected by matching form_name against /region endpoint
 * - 'gmax' detected by form_name === 'gmax' (PokeAPI naming convention)
 * - 'other' is the fallback for unrecognized forms
 */
export type VariantCategory = 'default' | 'mega' | 'regional' | 'gmax' | 'other';

/** Minimal Pokémon list entry as returned by generation listings. */
export interface PokemonBaseInfo {
  id: number;
  name: string;
  url: string;
  displayName: string;
  speciesId: number;
  isDefault: boolean;
  formName: string | null;
  variantCategory: VariantCategory;
  regionName?: string;
}

/** Normalized Pokémon details used for summary generation and display. */
export interface PokemonDetails {
  id: number;
  name: string;
  displayName: string;
  height: number;
  weight: number;
  types: string[];
  imagePng: string | null;
  imageSvg: string | null;
  flavorTexts: string[];
  allMoveNames: string[];
  habitat: string;
  generationId: number;
  region: string;
  speciesId: number;
  isDefault: boolean;
  formName: string | null;
  variantCategory: VariantCategory;
  regionName?: string;
}

/** A Pokémon generation available for selection. */
export interface Generation {
  id: number;
  name: string;
  region?: string;
}

/** Mode for controlling which stages of the pipeline to run. */
export enum WorkflowMode {
  FULL = 'FULL',
  SUMMARY_ONLY = 'SUMMARY_ONLY',
  AUDIO_ONLY = 'AUDIO_ONLY',
}

/** Collection type for the generator - standard generations or variant forms */
export type CollectionType = 'generation' | 'variants';

/** Collection filter for the generator UI */
export interface CollectionFilter {
  type: CollectionType;
  generationId?: number;
  variantCategories?: VariantCategory[];
  includeDefaults?: boolean;
}

/** Top-level page/view selection within the app. */
export enum AppView {
  HOME = 'HOME',
  GENERATION = 'GENERATION',
  POKEDEX_LIBRARY = 'POKEDEX_LIBRARY',
  ADMIN = 'ADMIN',
  PROCESSING = 'PROCESSING',
  RESULTS = 'RESULTS',
}

/**
 * A processed Pokémon result combining summary text, audio, and optional sprite
 * data for download/zipping.
 */
export interface ProcessedPokemon {
  id: number;
  name: string;
  displayName?: string;
  summary: string;
  audioData: string;
  pngData: string | null;
  svgData: string | null;
  variantCategory?: VariantCategory;
}

/** Cooldown UI state used to render waiting periods between API calls. */
export interface CooldownState {
  active: boolean;
  remainingMs: number;
  flavorText: string;
  currentSummary?: {
    id: number;
    name: string;
    text: string;
  };
}

/** Pokemon sprites structure from PokeAPI */
export interface PokemonSprites {
  front_default: string | null;
  other: {
    dream_world: {
      front_default: string | null;
    };
    home: {
      front_default: string | null;
    };
    'official-artwork': {
      front_default: string | null;
    };
  };
}

/** Variant category metadata for UI display */
export interface VariantCategoryInfo {
  id: VariantCategory;
  label: string;
  description: string;
  count: number;
}
