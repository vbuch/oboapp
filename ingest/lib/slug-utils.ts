import { randomInt } from "node:crypto";
import { adminDb } from "./firebase-admin";
import { SLUG_CHARS, SLUG_LENGTH } from "@oboapp/shared";

/**
 * Generates a cryptographically secure random URL-friendly slug
 * Uses crypto.randomInt for better randomness and unpredictability
 */
function generateSlug(): string {
  let slug = "";
  for (let i = 0; i < SLUG_LENGTH; i++) {
    const randomIndex = randomInt(0, SLUG_CHARS.length);
    slug += SLUG_CHARS[randomIndex];
  }
  return slug;
}

/**
 * Checks if a message document with this ID already exists
 */
async function messageIdExists(id: string): Promise<boolean> {
  const doc = await adminDb.collection("messages").doc(id).get();
  return doc.exists;
}

/**
 * Generates a unique slug-format ID that doesn't exist as a Firestore document ID
 * Retries up to maxAttempts times to avoid collisions
 */
export async function generateUniqueMessageId(): Promise<string> {
  const maxAttempts = 10;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const slug = generateSlug();
    const exists = await messageIdExists(slug);
    if (!exists) {
      return slug;
    }
    attempts++;
  }

  throw new Error(
    `Failed to generate unique message ID after ${maxAttempts} attempts`,
  );
}
