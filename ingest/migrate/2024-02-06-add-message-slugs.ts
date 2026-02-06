#!/usr/bin/env tsx
/**
 * MIGRATION: Add URL-friendly slugs to messages
 * 
 * WHAT: Generates and assigns unique 8-character alphanumeric slugs to all existing messages
 * 
 * WHY: Implements user-friendly shareable URLs (e.g., oboapp.online/m/aB3xYz12)
 *      replacing long Firestore document IDs in query strings
 * 
 * MODIFIES: Updates all documents in the 'messages' collection that don't have a 'slug' field
 * 
 * SAFE TO RE-RUN: Yes - automatically skips messages that already have slugs
 * 
 * BATCH SIZE: Processes 500 messages per Firestore batch commit
 * 
 * USAGE: npm run migrate:slugs
 * 
 * Related PR: Replace message IDs with short slugs in URLs
 */
import dotenv from "dotenv";
import { resolve } from "node:path";

// Load environment
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

/**
 * Generates a random URL-friendly slug
 * Using base62 (alphanumeric) for URL-friendliness
 */
function generateSlug(): string {
  const chars =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const length = 8;
  let slug = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    slug += chars[randomIndex];
  }
  return slug;
}

/**
 * Checks if a slug already exists in the database
 */
async function slugExists(
  db: FirebaseFirestore.Firestore,
  slug: string,
): Promise<boolean> {
  const snapshot = await db
    .collection("messages")
    .where("slug", "==", slug)
    .limit(1)
    .get();
  return !snapshot.empty;
}

/**
 * Generates a unique slug that doesn't exist in the database
 */
async function generateUniqueSlug(
  db: FirebaseFirestore.Firestore,
): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const slug = generateSlug();
    const exists = await slugExists(db, slug);
    if (!exists) {
      return slug;
    }
    attempts++;
  }

  throw new Error(
    `Failed to generate unique slug after ${maxAttempts} attempts`,
  );
}

async function migrateMessageSlugs() {
  console.log("🔄 Starting message slug migration...\n");

  const { adminDb } = await import("@/lib/firebase-admin");

  // Get all messages that don't have a slug
  const messagesRef = adminDb.collection("messages");
  const snapshot = await messagesRef.get();

  const messagesWithoutSlug = snapshot.docs.filter((doc) => {
    const data = doc.data();
    return !data.slug;
  });

  console.log(
    `📊 Found ${messagesWithoutSlug.length} messages without slugs out of ${snapshot.size} total messages\n`,
  );

  if (messagesWithoutSlug.length === 0) {
    console.log("✅ All messages already have slugs!\n");
    return;
  }

  // Process messages in batches of 500 (Firestore batch limit)
  const batchSize = 500;
  let processedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < messagesWithoutSlug.length; i += batchSize) {
    const batch = adminDb.batch();
    const batchMessages = messagesWithoutSlug.slice(i, i + batchSize);

    console.log(
      `Processing batch ${Math.floor(i / batchSize) + 1} (${batchMessages.length} messages)...`,
    );

    for (const doc of batchMessages) {
      try {
        const slug = await generateUniqueSlug(adminDb);
        batch.update(doc.ref, { slug });
        processedCount++;

        if (processedCount % 100 === 0) {
          console.log(`  ✓ Generated ${processedCount} slugs...`);
        }
      } catch (error) {
        console.error(`  ✗ Failed to generate slug for ${doc.id}:`, error);
        errorCount++;
      }
    }

    await batch.commit();
    console.log(`  ✅ Batch committed (${processedCount} total)\n`);
  }

  console.log("📈 Migration Summary:");
  console.log(`  ✅ Successfully migrated: ${processedCount} messages`);
  if (errorCount > 0) {
    console.log(`  ✗ Failed: ${errorCount} messages`);
  }
  console.log("\n✨ Migration complete!\n");
}

migrateMessageSlugs().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
