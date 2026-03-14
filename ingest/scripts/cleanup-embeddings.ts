#!/usr/bin/env tsx
import dotenv from "dotenv";
import { resolve } from "node:path";

// Load environment before Firebase Admin initializes
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const BATCH_SIZE = 500;

// NOTE: This script uses raw Firestore admin instead of @oboapp/db because
// it needs FieldValue.delete() (field removal) and batch writes, which the
// @oboapp/db abstraction layer doesn't support.
async function cleanupEmbeddings() {
  const { adminDb } = await import("@/lib/firebase-admin");
  const { FieldValue } = await import("firebase-admin/firestore");

  const now = new Date().toISOString();
  let totalCleaned = 0;

  // Clean expired messages
  const messagesRef = adminDb.collection("messages");
  const msgQuery = messagesRef
    .where("timespanEnd", "<", now)
    .where("embedding", "!=", null)
    .limit(BATCH_SIZE);

  let msgSnapshot = await msgQuery.get();

  while (!msgSnapshot.empty) {
    const batch = adminDb.batch();
    for (const doc of msgSnapshot.docs) {
      batch.update(doc.ref, { embedding: FieldValue.delete() });
    }
    await batch.commit();
    totalCleaned += msgSnapshot.size;
    console.log(`  Cleaned ${msgSnapshot.size} messages (total: ${totalCleaned})`);

    // Get next batch
    msgSnapshot = await msgQuery.get();
  }

  // Clean expired events
  const eventsRef = adminDb.collection("events");
  const evtQuery = eventsRef
    .where("timespanEnd", "<", now)
    .where("embedding", "!=", null)
    .limit(BATCH_SIZE);

  let evtSnapshot = await evtQuery.get();

  while (!evtSnapshot.empty) {
    const batch = adminDb.batch();
    for (const doc of evtSnapshot.docs) {
      batch.update(doc.ref, { embedding: FieldValue.delete() });
    }
    await batch.commit();
    totalCleaned += evtSnapshot.size;
    console.log(`  Cleaned ${evtSnapshot.size} events (total: ${totalCleaned})`);

    evtSnapshot = await evtQuery.get();
  }

  console.log(`\nDone. Removed embeddings from ${totalCleaned} expired documents.`);
}

cleanupEmbeddings().catch((error) => {
  console.error("Cleanup failed:", error);
  process.exit(1);
});
