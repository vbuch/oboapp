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
 * COLLISION PREVENTION:
 * - Uses crypto-secure random generation (crypto.randomInt)
 * - Checks database for existing slugs
 * - Tracks generated slugs in-memory to prevent duplicates within the migration run
 * 
 * USAGE: npx tsx migrate/2024-02-06-add-message-slugs.ts
 * 
 * Related PR: Replace message IDs with short slugs in URLs
 */
import dotenv from "dotenv";
import { resolve } from "node:path";
import { randomInt } from "node:crypto";
import { SLUG_CHARS, SLUG_LENGTH } from "@oboapp/shared";

// Load environment
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

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

  // Track all slugs generated during this migration run to prevent duplicates
  const generatedSlugsInRun = new Set<string>();

  /**
   * Generates a cryptographically secure random slug
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
   * Checks if a slug exists in the database
   */
  async function slugExistsInDb(slug: string): Promise<boolean> {
    const existingSnapshot = await messagesRef
      .where("slug", "==", slug)
      .limit(1)
      .get();
    return !existingSnapshot.empty;
  }

  /**
   * Generates a unique slug, checking both database and in-memory set
   */
  async function generateUniqueSlug(): Promise<string> {
    const maxAttempts = 20; // Increased for migration safety
    let attempts = 0;

    while (attempts < maxAttempts) {
      const slug = generateSlug();

      // Check if slug was generated in this run
      if (generatedSlugsInRun.has(slug)) {
        attempts++;
        continue;
      }

      // Check if slug exists in database
      const existsInDb = await slugExistsInDb(slug);
      if (!existsInDb) {
        // Reserve this slug for this run
        generatedSlugsInRun.add(slug);
        return slug;
      }

      attempts++;
    }

    throw new Error(
      `Failed to generate unique slug after ${maxAttempts} attempts`,
    );
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
        const slug = await generateUniqueSlug();
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
  console.log(`  🔒 Unique slugs tracked in run: ${generatedSlugsInRun.size}`);
  if (errorCount > 0) {
    console.log(`  ✗ Failed: ${errorCount} messages`);
  }
  console.log("\n✨ Migration complete!\n");
}

migrateMessageSlugs().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
