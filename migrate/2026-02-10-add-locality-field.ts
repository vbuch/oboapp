#!/usr/bin/env npx tsx

/**
 * Migration script to backfill locality field for existing sources and messages
 * Run with: npx tsx migrate/2026-02-10-add-locality-field.ts
 */

import dotenv from "dotenv";
import { resolve } from "node:path";

// Load environment variables before importing firebase-admin
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { adminDb } = await import("../ingest/lib/firebase-admin");

  console.log("Starting migration to add locality field...");

  // Default locality for all existing records
  const DEFAULT_LOCALITY = "bg.sofia";

  // Migrate sources collection
  console.log("\n1. Migrating sources collection...");
  const sourcesSnapshot = await adminDb.collection("sources").get();
  console.log(`Found ${sourcesSnapshot.size} sources`);

  let sourcesUpdated = 0;
  let sourcesSkipped = 0;

  for (const doc of sourcesSnapshot.docs) {
    const data = doc.data();
    
    // Skip if locality already exists
    if (data.locality) {
      sourcesSkipped++;
      continue;
    }

    // Update with default locality
    await doc.ref.update({ locality: DEFAULT_LOCALITY });
    sourcesUpdated++;

    if (sourcesUpdated % 100 === 0) {
      console.log(`  Updated ${sourcesUpdated} sources...`);
    }
  }

  console.log(`✓ Sources migration complete: ${sourcesUpdated} updated, ${sourcesSkipped} skipped`);

  // Migrate messages collection
  console.log("\n2. Migrating messages collection...");
  const messagesSnapshot = await adminDb.collection("messages").get();
  console.log(`Found ${messagesSnapshot.size} messages`);

  let messagesUpdated = 0;
  let messagesSkipped = 0;

  for (const doc of messagesSnapshot.docs) {
    const data = doc.data();
    
    // Skip if locality already exists
    if (data.locality) {
      messagesSkipped++;
      continue;
    }

    // Update with default locality
    await doc.ref.update({ locality: DEFAULT_LOCALITY });
    messagesUpdated++;

    if (messagesUpdated % 100 === 0) {
      console.log(`  Updated ${messagesUpdated} messages...`);
    }
  }

  console.log(`✓ Messages migration complete: ${messagesUpdated} updated, ${messagesSkipped} skipped`);

  console.log("\n✓ Migration completed successfully!");
  console.log(`  Total sources updated: ${sourcesUpdated}`);
  console.log(`  Total messages updated: ${messagesUpdated}`);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
