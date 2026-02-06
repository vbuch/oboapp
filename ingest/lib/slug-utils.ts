import { adminDb } from "./firebase-admin";

/**
 * Characters used in slug generation
 * Using base62 (alphanumeric) for URL-friendliness
 */
const SLUG_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Length of generated slugs
 * 8 characters gives us 62^8 = ~218 trillion possible combinations
 */
const SLUG_LENGTH = 8;

/**
 * Generates a random URL-friendly slug
 */
function generateSlug(): string {
  let slug = "";
  for (let i = 0; i < SLUG_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * SLUG_CHARS.length);
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
