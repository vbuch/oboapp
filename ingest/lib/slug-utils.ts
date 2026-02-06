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
 * Checks if a slug already exists in the database
 */
async function slugExists(slug: string): Promise<boolean> {
  const snapshot = await adminDb
    .collection("messages")
    .where("slug", "==", slug)
    .limit(1)
    .get();
  return !snapshot.empty;
}

/**
 * Generates a unique slug that doesn't exist in the database
 * Retries up to maxAttempts times to avoid collisions
 */
export async function generateUniqueSlug(): Promise<string> {
  const maxAttempts = 10;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const slug = generateSlug();
    const exists = await slugExists(slug);
    if (!exists) {
      return slug;
    }
    attempts++;
  }

  throw new Error(
    `Failed to generate unique slug after ${maxAttempts} attempts`,
  );
}

/**
 * Atomically assigns a slug to a message using Firestore transaction
 * Ensures that only the first writer sets the slug, preventing race conditions
 * 
 * Note: While this ensures atomicity for a single message document, it does NOT
 * guarantee global slug uniqueness across all messages because slug generation
 * happens outside the transaction. This is an acceptable trade-off given:
 * 1. The collision probability with 62^8 combinations is extremely low
 * 2. Duplicate detection exists in the API layer
 * 3. True global uniqueness would require a separate slug reservation collection
 * 
 * Returns the slug (either newly assigned or existing)
 */
export async function ensureMessageHasSlugAtomic(
  messageId: string,
): Promise<string> {
  const messageRef = adminDb.collection("messages").doc(messageId);

  return await adminDb.runTransaction(async (transaction) => {
    const doc = await transaction.get(messageRef);

    if (!doc.exists) {
      throw new Error(`Message ${messageId} not found`);
    }

    const data = doc.data();

    // If slug already exists, return it (immutability)
    if (data?.slug) {
      return data.slug;
    }

    // Generate a new unique slug (outside transaction - see note above)
    const slug = await generateUniqueSlug();

    // Set the slug atomically
    transaction.update(messageRef, { slug });

    return slug;
  });
}
