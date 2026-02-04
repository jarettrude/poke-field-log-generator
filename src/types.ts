/** Minimal Pokémon list entry as returned by generation listings. */
export interface PokemonBaseInfo {
  id: number;
  name: string;
  url: string;
}

/** Normalized Pokémon details used for summary generation and display. */
export interface PokemonDetails {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: string[];
  imagePng: string | null;
  imageSvg: string | null;
  flavorTexts: string[];
  allMoveNames: string[];
  habitat: string; // Added for narrative context
  region?: string; // Region name (Kanto, Johto, etc.)
}

/** A Pokémon generation available for selection. */
export interface Generation {
  id: number;
  name: string;
  region?: string;
}

/** Mode for controlling which stages of the pipeline to run. */
export enum WorkflowMode {
  FULL = 'FULL', // Generate summaries + audio (end-to-end)
  SUMMARY_ONLY = 'SUMMARY_ONLY', // Generate and save summaries only
  AUDIO_ONLY = 'AUDIO_ONLY', // Load saved summaries and generate audio
}

/** Top-level page/view selection within the app. */
export enum AppView {
  HOME = 'HOME', // Mode selection
  GENERATION = 'GENERATION', // Generation/range selection
  POKEDEX_LIBRARY = 'POKEDEX_LIBRARY', // Unified Pokedex library
  ADMIN = 'ADMIN', // Edit prompts
  PROCESSING = 'PROCESSING', // Processing overlay
  RESULTS = 'RESULTS', // View results
}

/**
 * A processed Pokémon result combining summary text, audio, and optional sprite
 * data for download/zipping.
 */
export interface ProcessedPokemon {
  id: number;
  name: string;
  summary: string;
  audioData: string; // Base64
  pngData: string | null;
  svgData: string | null;
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
