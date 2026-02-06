import { randomInt } from "node:crypto";
import { MESSAGE_ID_CHARS, MESSAGE_ID_LENGTH } from "@oboapp/shared";

/**
 * Generates a cryptographically secure random URL-friendly message ID
 * Uses crypto.randomInt for better randomness and unpredictability
 * 
 * Note: This function does NOT check for uniqueness. Callers should use
 * atomic create operations with retry logic to handle collisions.
 */
export function generateMessageId(): string {
  let id = "";
  for (let i = 0; i < MESSAGE_ID_LENGTH; i++) {
    const randomIndex = randomInt(0, MESSAGE_ID_CHARS.length);
    id += MESSAGE_ID_CHARS[randomIndex];
  }
  return id;
}
