import { pcmToWavBlob } from './audioUtils';
import { ProcessedPokemon } from '../types';
import { formatPokemonId } from '../utils/pokemonUtils';

// JSZip global type declaration for CDN loaded library
interface JSZipInstance {
  folder(name: string): JSZipInstance;
  file(name: string, data: Blob | string): void;
  generateAsync(options: { type: 'blob' }): Promise<Blob>;
}

interface JSZipConstructor {
  new (): JSZipInstance;
}

// Extend Window interface to include dynamically loaded JSZip
declare global {
  interface Window {
    JSZip?: JSZipConstructor;
  }
}

const loadJSZip = async (): Promise<void> => {
  if (window.JSZip) return;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load JSZip'));
    document.head.appendChild(script);
  });
};

/**
 * Fetch a URL and return its body as a `Blob`.
 *
 * Returns `null` if the request fails.
 */
const fetchAsBlob = async (url: string): Promise<Blob | null> => {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Fetch failed');
    return await res.blob();
  } catch (e) {
    console.error(`Failed to fetch blob from ${url}`, e);
    return null;
  }
};

/**
 * Create a zip file containing audio, sprites, and summary text for a single Pokémon.
 */
export const createPokemonZip = async (pokemon: ProcessedPokemon): Promise<Blob> => {
  await loadJSZip();
  if (!window.JSZip) throw new Error('JSZip not loaded');
  const zip = new window.JSZip();
  const paddedId = formatPokemonId(pokemon.id);
  const folderName = `${paddedId}-${pokemon.name}`;
  const folder = zip.folder(folderName);

  if (pokemon.audioData) {
    const audioBlob = pcmToWavBlob(pokemon.audioData);
    folder.file(`${paddedId}-${pokemon.name}.wav`, audioBlob);
  }

  if (pokemon.pngData) {
    const pngBlob = await fetchAsBlob(pokemon.pngData);
    if (pngBlob) folder.file(`${paddedId}-${pokemon.name}.png`, pngBlob);
  }

  if (pokemon.svgData) {
    const svgBlob = await fetchAsBlob(pokemon.svgData);
    if (svgBlob) folder.file(`${paddedId}-${pokemon.name}.svg`, svgBlob);
  }

  // Add summary text file
  folder.file(`${paddedId}-${pokemon.name}.txt`, pokemon.summary);

  return zip.generateAsync({ type: 'blob' });
};

/**
 * Create a zip file containing results for a batch of Pokémon.
 *
 * Each Pokémon is placed in its own folder, containing WAV audio (if present),
 * optional sprites, and a summary text file.
 */
export const createBatchZip = async (
  batchResults: ProcessedPokemon[],
  _batchId: number
): Promise<Blob> => {
  await loadJSZip();
  if (!window.JSZip) throw new Error('JSZip not loaded');
  const zip = new window.JSZip();

  for (const pokemon of batchResults) {
    const paddedId = formatPokemonId(pokemon.id);
    const folder = zip.folder(`${paddedId}-${pokemon.name}`);

    if (pokemon.audioData) {
      const audioBlob = pcmToWavBlob(pokemon.audioData);
      folder.file(`${paddedId}-${pokemon.name}.wav`, audioBlob);
    }

    if (pokemon.pngData) {
      const pngBlob = await fetchAsBlob(pokemon.pngData);
      if (pngBlob) folder.file(`${paddedId}-${pokemon.name}.png`, pngBlob);
    }

    if (pokemon.svgData) {
      const svgBlob = await fetchAsBlob(pokemon.svgData);
      if (svgBlob) folder.file(`${paddedId}-${pokemon.name}.svg`, svgBlob);
    }

    // Add summary text file
    folder.file(`${paddedId}-${pokemon.name}.txt`, pokemon.summary);
  }

  return zip.generateAsync({ type: 'blob' });
};
