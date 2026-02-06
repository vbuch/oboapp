import { randomInt } from "node:crypto";
import { SLUG_CHARS, SLUG_LENGTH } from "@oboapp/shared";

/**
 * Generates a cryptographically secure random URL-friendly slug
 * Uses crypto.randomInt for better randomness and unpredictability
 * 
 * Note: This function does NOT check for uniqueness. Callers should use
 * atomic create operations with retry logic to handle collisions.
 */
export function generateSlug(): string {
  let slug = "";
  for (let i = 0; i < SLUG_LENGTH; i++) {
    const randomIndex = randomInt(0, SLUG_CHARS.length);
    slug += SLUG_CHARS[randomIndex];
  }
  return slug;
}
