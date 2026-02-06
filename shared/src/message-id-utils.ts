/**
 * Shared utilities for URL-friendly message identifiers
 * 
 * Message IDs are 8-character alphanumeric identifiers (base62) used in message URLs
 * Example: aB3xYz12
 */

/**
 * Characters used in message ID generation
 * Using base62 (alphanumeric) for URL-friendliness
 */
export const MESSAGE_ID_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Length of generated message IDs
 * 8 characters gives us 62^8 = ~218 trillion possible combinations
 */
export const MESSAGE_ID_LENGTH = 8;

/**
 * Validates if a string is a valid message ID format
 * @param id - String to validate
 * @returns true if the ID matches the expected format
 */
export function isValidMessageId(id: string): boolean {
  if (!id || id.length !== MESSAGE_ID_LENGTH) {
    return false;
  }
  return /^[0-9A-Za-z]+$/.test(id);
}
