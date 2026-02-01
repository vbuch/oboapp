#!/usr/bin/env tsx
import dotenv from "dotenv";
import { resolve } from "node:path";

// Load emulator environment
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function clearData() {
  console.log("🗑️  Clearing all emulator data...\n");

  const { adminDb } = await import("@/lib/firebase-admin");

  // Delete all documents from each collection
  const collections = ["users", "sources", "messages"];

  for (const collectionName of collections) {
    const collectionRef = adminDb.collection(collectionName);
    const snapshot = await collectionRef.get();

    if (snapshot.empty) {
      console.log(`  ${collectionName}: already empty`);
      continue;
    }

    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(
      `  ✅ Deleted ${snapshot.size} documents from ${collectionName}`,
    );
  }

  console.log("\n✨ All data cleared!\n");
}

clearData().catch(console.error);
