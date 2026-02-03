/**
 * Utility functions for Pokemon ID formatting and range handling
 */

/**
 * Formats a Pokemon ID with appropriate zero-padding based on the range
 * - 1-9: No padding (1, 2, 3...)
 * - 10-99: No padding (10, 11, 12...)
 * - 100-999: 3-digit padding (001, 010, 999)
 * - 1000-9999: 4-digit padding (0001, 1000, 9999)
 * - 10000+: 5-digit padding (00001, 10000, etc.)
 */
export const formatPokemonId = (id: number, maxId: number = 1025): string => {
  if (maxId >= 10000) return id.toString().padStart(5, '0');
  if (maxId >= 1000) return id.toString().padStart(4, '0');
  if (maxId >= 100) return id.toString().padStart(3, '0');
  return id.toString(); // No padding for ranges under 100
};
