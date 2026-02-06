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
 * SAFE TO RE-RUN: Yes - uses transactions to only set slug if still missing (concurrent-safe)
 * 
 * BATCH SIZE: Processes 100 messages per batch (uses transactions, not batch writes)
 * 
 * COLLISION PREVENTION:
 * - Reuses slug generation utilities from ingest/lib/slug-utils.ts
 * - Uses crypto-secure random generation (crypto.randomInt)
 * - Checks database for existing slugs
 * - Tracks generated slugs in-memory to prevent duplicates within the migration run
 * - Uses Firestore transactions to prevent race conditions
 * 
 * USAGE: npx tsx migrate/2024-02-06-add-message-slugs.ts
 * 
 * Related PR: Replace message IDs with short slugs in URLs
 */
import dotenv from "dotenv";
import { resolve } from "node:path";

// Load environment
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function migrateMessageSlugs() {
  console.log("🔄 Starting message slug migration...\n");

  const { adminDb } = await import("@/lib/firebase-admin");
  const { generateUniqueSlug } = await import("@/lib/slug-utils");

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

  // Track all slugs generated during this migration run to prevent duplicates
  const generatedSlugsInRun = new Set<string>();

  /**
   * Generates a unique slug, checking both database and in-memory set
   * Wraps the imported generateUniqueSlug to add in-memory tracking
   */
  async function generateUniqueSlugWithTracking(): Promise<string> {
    const maxAttempts = 20;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const slug = await generateUniqueSlug();

      // Check if slug was generated in this run
      if (generatedSlugsInRun.has(slug)) {
        attempts++;
        continue;
      }

      // Reserve this slug for this run
      generatedSlugsInRun.add(slug);
      return slug;
    }

    throw new Error(
      `Failed to generate unique slug after ${maxAttempts} attempts`,
    );
  }

  /**
   * Atomically sets slug on a message using a transaction
   * Only sets if the message still doesn't have a slug
   */
  async function setSlugIfMissing(
    messageId: string,
    slug: string,
  ): Promise<boolean> {
    const messageRef = messagesRef.doc(messageId);

    return await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(messageRef);

      if (!doc.exists) {
        console.warn(`  ⚠️  Message ${messageId} not found, skipping`);
        return false;
      }

      const data = doc.data();

      // If slug was set by another process, skip
      if (data?.slug) {
        return false;
      }

      // Set the slug atomically
      transaction.update(messageRef, { slug });
      return true;
    });
  }

  // Process messages in batches of 100 (using transactions, not batch writes)
  const batchSize = 100;
  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < messagesWithoutSlug.length; i += batchSize) {
    const batchMessages = messagesWithoutSlug.slice(i, i + batchSize);

    console.log(
      `Processing batch ${Math.floor(i / batchSize) + 1} (${batchMessages.length} messages)...`,
    );

    for (const doc of batchMessages) {
      try {
        const slug = await generateUniqueSlugWithTracking();
        const wasSet = await setSlugIfMissing(doc.id, slug);

        if (wasSet) {
          processedCount++;
          if (processedCount % 100 === 0) {
            console.log(`  ✓ Generated ${processedCount} slugs...`);
          }
        } else {
          skippedCount++;
          // Remove from in-memory tracking since it wasn't used
          generatedSlugsInRun.delete(slug);
        }
      } catch (error) {
        console.error(`  ✗ Failed to generate slug for ${doc.id}:`, error);
        errorCount++;
      }
    }

    console.log(`  ✅ Batch completed (${processedCount} total)\n`);
  }

  console.log("📈 Migration Summary:");
  console.log(`  ✅ Successfully migrated: ${processedCount} messages`);
  console.log(`  🔒 Unique slugs tracked in run: ${generatedSlugsInRun.size}`);
  if (skippedCount > 0) {
    console.log(`  ⏭️  Skipped (already had slug): ${skippedCount} messages`);
  }
  if (errorCount > 0) {
    console.log(`  ✗ Failed: ${errorCount} messages`);
  }
  console.log("\n✨ Migration complete!\n");
}

migrateMessageSlugs().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
