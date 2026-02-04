/**
 * Prompt Service for Pokemon Field Log Generator
 * Manages system prompts with defaults and database overrides
 */

const API_BASE = '/api/prompts';

/** Identifiers for supported prompt templates. */
export type PromptType = 'summary' | 'tts';

/** Prompt content by prompt type. */
export interface PromptConfig {
  summary: string;
  tts: string;
}

/**
 * Default summary generation prompt
 */
export const DEFAULT_SUMMARY_PROMPT = `
You are an elite Pokémon Field Researcher. You record immersive, high-fidelity 'Mission Logs' for the national database.

OPENING LINE STRUCTURE:
Begin with: "Pokémon trainer log [LOG_ID]. [CREATIVE_OPENING]"

- LOG_ID: The National Pokédex number (1-99 no padding, 100-999 as 3 digits, 1000+ as 4+ digits)
- CREATIVE_OPENING: A unique, evocative sentence introducing the encounter. NEVER start with "Today, I witnessed/encountered/came across." Instead, vary your approach:
  * Start with the environment ("The morning mist parted to reveal...")
  * Start with the Pokémon's action ("A flash of flame erupted from the underbrush...")
  * Start with your reaction ("I froze mid-step when...")
  * Start with sensory detail ("The acrid scent of smoke led me to...")
  * Start with time/weather ("Under the crimson twilight of...")
  * Start mid-action ("Crouching behind a boulder, I finally spotted...")

CRITICAL: Each log MUST open differently. If you default to a generic "Today I witnessed" pattern, you have failed this task. Be cinematic and unpredictable.

NARRATIVE REQUIREMENTS:
1. PERSPECTIVE: You are an observer recording a personal voice log in the field.
2. CONTENT: Describe a unique, vivid encounter. Use the Lore Context to inform the Pokémon's personality (intense, gentle, mysterious, etc.).
3. LOCATION: Weave in the region (Kanto, Johto, etc.) and habitat naturally—don't just state them.
4. ECOSYSTEM: When appropriate, mention other Pokémon species that share this environment.
5. MOVES: Incorporate 2-4 moves from the provided list. Describe them as natural biological actions or displays of power—never list them.
6. LENGTH: 250-300 words per entry.
7. FORMATTING: **Bold** move names within the prose (e.g., **Flame Wheel**, **Hydro Pump**).
8. TONE: Cinematic and immersive, with the quiet reverence of a nature documentarian.

IMPORTANT: Provide the response in strict JSON format.
`;

/**
 * Default TTS (Text-to-Speech) prompt with Director's Note
 */
export const DEFAULT_TTS_PROMPT = `
[Director's Note]
Voice: A warm, velvety female voice with a rich mid-range. Full and present—never whispered or breathy. Think: elegant nature documentary narrator with effortless allure.
Tone: Soothing yet captivating. Gentle confidence with understated warmth. A voice you want to keep listening to.
Delivery: Unhurried and flowing, with natural melodic rises and falls—never monotone or flat. Let sentences breathe with natural pauses, not audible breaths. Slight warmth on emphasized words, never sharp.
Pacing: Languid and measured. Generous pauses at punctuation. No rushing.
Avoid: Whispery ASMR, audible breathing, uptalk, vocal fry, nasal quality, overly perky inflection, robotic flatness, theatrical announcer style.
Technical: High-clarity, intimate proximity (close-mic warmth, not whisper). Clean ending with no trailing artifacts.
[/Director's Note]
`;

/**
 * Get stored prompt overrides from database
 */
const getStoredOverrides = async (): Promise<Partial<PromptConfig>> => {
  try {
    const response = await fetch(API_BASE);
    if (!response.ok) return {};

    const prompts = await response.json();
    const overrides: Partial<PromptConfig> = {};

    prompts.forEach((prompt: { type: string; content: string }) => {
      if (prompt.type === 'summary') {
        overrides.summary = prompt.content;
      } else if (prompt.type === 'tts') {
        overrides.tts = prompt.content;
      }
    });

    return overrides;
  } catch {
    return {};
  }
};

/**
 * Save prompt overrides to database
 */
const saveOverrides = async (overrides: Partial<PromptConfig>): Promise<void> => {
  try {
    for (const [type, content] of Object.entries(overrides)) {
      if (content) {
        await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, content }),
        });
      }
    }
  } catch (error) {
    console.error('Failed to save prompt overrides:', error);
  }
};

/**
 * Get the active prompt template.
 *
 * Returns a stored override if one exists, otherwise the default prompt.
 */
export const getPrompt = async (type: PromptType): Promise<string> => {
  const overrides = await getStoredOverrides();

  switch (type) {
    case 'summary':
      return overrides.summary || DEFAULT_SUMMARY_PROMPT;
    case 'tts':
      return overrides.tts || DEFAULT_TTS_PROMPT;
    default:
      return '';
  }
};

/**
 * Get the default prompt template (ignoring any stored overrides).
 */
export const getDefaultPrompt = (type: PromptType): string => {
  switch (type) {
    case 'summary':
      return DEFAULT_SUMMARY_PROMPT;
    case 'tts':
      return DEFAULT_TTS_PROMPT;
    default:
      return '';
  }
};

/**
 * Store a prompt override for a given type.
 */
export const setPromptOverride = async (type: PromptType, prompt: string): Promise<void> => {
  await saveOverrides({ [type]: prompt });
};

/**
 * Clear a specific prompt override (revert to default).
 */
export const clearPromptOverride = async (type: PromptType): Promise<void> => {
  try {
    await fetch(`${API_BASE}?type=${type}`, { method: 'DELETE' });
  } catch (error) {
    console.error('Failed to clear prompt override:', error);
  }
};

/**
 * Clear all stored prompt overrides.
 */
export const clearAllPromptOverrides = async (): Promise<void> => {
  try {
    const response = await fetch(API_BASE);
    const prompts = await response.json();

    for (const prompt of prompts) {
      await fetch(`${API_BASE}?type=${prompt.type}`, { method: 'DELETE' });
    }
  } catch (error) {
    console.error('Failed to clear all prompt overrides:', error);
  }
};

/**
 * Check whether a given prompt type has a stored override.
 */
export const hasPromptOverride = async (type: PromptType): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/${type}`);
    return response.ok && response.status !== 404;
  } catch {
    return false;
  }
};

/**
 * Get all prompts (defaults + active values) and whether overrides exist.
 */
export const getAllPrompts = async (): Promise<{
  defaults: PromptConfig;
  current: PromptConfig;
  hasOverrides: { summary: boolean; tts: boolean };
}> => {
  const overrides = await getStoredOverrides();

  return {
    defaults: {
      summary: DEFAULT_SUMMARY_PROMPT,
      tts: DEFAULT_TTS_PROMPT,
    },
    current: {
      summary: overrides.summary || DEFAULT_SUMMARY_PROMPT,
      tts: overrides.tts || DEFAULT_TTS_PROMPT,
    },
    hasOverrides: {
      summary: !!overrides.summary,
      tts: !!overrides.tts,
    },
  };
};
