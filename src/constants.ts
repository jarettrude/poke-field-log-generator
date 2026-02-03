/**
 * Application-wide UI constants.
 */

/** Default Pokéball sprite used as a fallback image. */
export const POKEBALL_IMAGE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';

/** Available prebuilt Gemini voice profiles for TTS. */
export const VOICE_OPTIONS = [
  { id: 'Kore', name: 'Kore (Sophisticated)', gender: 'Female' },
  { id: 'Zephyr', name: 'Zephyr (Professional)', gender: 'Female' },
  { id: 'Charon', name: 'Charon (Resonant)', gender: 'Male' },
  { id: 'Puck', name: 'Puck (Youthful)', gender: 'Male' },
  { id: 'Fenrir', name: 'Fenrir (Rugged)', gender: 'Male' },
];

/** Flavor text snippets shown during cooldown periods. */
export const COOLDOWN_FLAVOR_TEXTS = [
  'The Pokédex is recalibrating its sensor array...',
  "Consulting the Professor's hidden field notes...",
  'Luring rare specimens with high-quality bait...',
  'Calibrating the resonance engine for perfect pitch...',
  'Deciphering ancient species vocalizations...',
  'Adjusting the thermal sensors for tracking...',
  'Waiting for the specimen to emerge from the grass...',
  'Synthesizing high-fidelity audio frequencies...',
  'Transcribing the language of the wild...',
  'Cleaning recording equipment from forest debris...',
  'Professor Oak is reviewing the previous entry...',
  'Syncing with the Regional Archives...',
  'Local Pikachu interference detected, waiting...',
  'Recharging the biometric scanner batteries...',
];

/**
 * Select a random cooldown flavor text.
 */
export const getRandomFlavorText = () =>
  COOLDOWN_FLAVOR_TEXTS[Math.floor(Math.random() * COOLDOWN_FLAVOR_TEXTS.length)];
