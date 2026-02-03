/**
 * Server-side prompt retrieval with database override support.
 */

import { getDatabase } from '@/lib/db/adapter';
import { DEFAULT_SUMMARY_PROMPT, DEFAULT_TTS_PROMPT } from '@/services/promptService';

/**
 * Get the active prompt for a given type, falling back to defaults if no override exists.
 */
export async function getActivePrompt(type: 'summary' | 'tts'): Promise<string> {
  const db = await getDatabase();
  const stored = await db.getPrompt(type);
  if (stored?.content) return stored.content;
  return type === 'summary' ? DEFAULT_SUMMARY_PROMPT : DEFAULT_TTS_PROMPT;
}
