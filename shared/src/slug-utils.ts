/**
 * Shared slug utilities for URL-friendly message identifiers
 * 
 * Slugs are 8-character alphanumeric identifiers (base62) used in message URLs
 * Example: aB3xYz12
 */

/**
 * Characters used in slug generation
 * Using base62 (alphanumeric) for URL-friendliness
 */
export const SLUG_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Length of generated slugs
 * 8 characters gives us 62^8 = ~218 trillion possible combinations
 */
export const SLUG_LENGTH = 8;

/**
 * Validates if a string is a valid slug format
 * @param slug - String to validate
 * @returns true if the slug matches the expected format
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length !== SLUG_LENGTH) {
    return false;
  }
  return /^[0-9A-Za-z]+$/.test(slug);
}
