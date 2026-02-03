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

REQUIRED FORMAT:
"Pokémon trainer log [NATIONAL POKEDEX NUMBER - Use appropriate zero-padding: 1-99 (no padding), 100-999 (3 digits), 1000+ (4+ digits)]. Today, I [encountered / witnessed / came across (these are examples only - feel free to take creative liberties)] a [Name] ([Phonetic Pronunciation]) [near / in / at (examples only)] [Habitat] within the [Region] region."

NARRATIVE STYLE (Follow strictly):
1. PERSPECTIVE: You are an observer in the field. This is your personal voice recording.
2. CONTENT: Describe a unique, vivid encounter. Use the Lore Context to inform the personality (intense, gentle, mysterious, etc.).
3. REGION & HABITAT: Always mention the region (Kanto, Johto, etc.) and specific habitat type.
4. OTHER POKEMON: If appropriate based on habitat, mention other Pokémon species that share this environment. Draw from your knowledge of the Pokémon world and games.
5. MOVES: Incorporate 2-4 moves from the provided list. Do NOT just list them; describe them as natural biological actions or displays of power.
6. WORD COUNT: 200-250 words per entry.
7. FORMATTING: You MUST **bold** the names of the moves (e.g., **Flame Wheel** or **Hydro Pump**) within the story.
8. TONE: Immersive and exciting, yet delivered with the quiet reverence of a nature documentarian. 
9. ORIGINALITY: Rewrite the data into fresh, cinematic prose. Avoid repeating the provided snippets verbatim.
10. LOG ID: The log ID MUST be the Pokemon's National Pokedex number from the provided POKEMON DATA, formatted with appropriate zero-padding based on the number range (1-99: no padding, 100-999: 3 digits, 1000+: 4+ digits).

IMPORTANT: Provide the response in strict JSON format.
`;

/**
 * Default TTS (Text-to-Speech) prompt with Director's Note
 */
export const DEFAULT_TTS_PROMPT = `
[Director's Note]
Style: High-fidelity nature documentary narration. Professional field researcher recording a private observation log in a quiet environment.
Tone: Serene, melodic, and intimate. A female voice with a warm, resonant mid-range. Captivating and sophisticated; avoid theatrical or "announcer" tropes.
Delivery: Maintain a flat, authoritative cadence. Strictly avoid upward inflections (uptalk) at the end of sentences. No vocal fry.
Emphasis: Treat bolded terms with a slight, respectful weight—steady and clear, rather than excited.
Pacing: Slow, deliberate, and measured. Natural, brief pauses only at punctuation.
Technical: High-clarity audio. Ensure a clean "cold finish" immediately after the final word.
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
