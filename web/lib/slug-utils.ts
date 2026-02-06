/**
 * Utilities for generating and working with short, URL-friendly message slugs
 * Similar to YouTube-style short IDs (e.g., "aB3xYz")
 */

/**
 * Characters used in slug generation
 * Using base62 (alphanumeric) for URL-friendliness
 */
const SLUG_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Length of generated slugs
 * 8 characters gives us 62^8 = ~218 trillion possible combinations
 * More than enough for millions of messages with very low collision probability
 */
const SLUG_LENGTH = 8;

/**
 * Generates a random URL-friendly slug
 * @returns A random alphanumeric string of SLUG_LENGTH characters
 */
export function generateSlug(): string {
  let slug = "";
  for (let i = 0; i < SLUG_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * SLUG_CHARS.length);
    slug += SLUG_CHARS[randomIndex];
  }
  return slug;
}

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
