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

  const now = new Date();
  let totalCleaned = 0;

  // Clean expired messages
  // Query only by timespanEnd (single inequality) and filter embedding in code,
  // because Firestore does not support != combined with another inequality filter.
  // Uses orderBy + startAfter pagination to avoid infinite loops.
  const messagesRef = adminDb.collection("messages");
  let msgLastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  while (true) {
    let msgQuery = messagesRef
      .where("timespanEnd", "<", now)
      .orderBy("timespanEnd")
      .limit(BATCH_SIZE);

    if (msgLastDoc) {
      msgQuery = msgQuery.startAfter(msgLastDoc);
    }

    const msgSnapshot = await msgQuery.get();
    if (msgSnapshot.empty) break;

    msgLastDoc = msgSnapshot.docs[msgSnapshot.docs.length - 1];

    const batch = adminDb.batch();
    let batchCount = 0;
    for (const doc of msgSnapshot.docs) {
      if (doc.data().embedding != null) {
        batch.update(doc.ref, { embedding: FieldValue.delete() });
        batchCount++;
      }
    }
    if (batchCount > 0) {
      await batch.commit();
      totalCleaned += batchCount;
      console.log(`  Cleaned ${batchCount} messages (total: ${totalCleaned})`);
    }

    if (msgSnapshot.size < BATCH_SIZE) break;
  }

  // Clean expired events
  // Events store timespanEnd as ISO strings, so compare with ISO string
  const nowISO = now.toISOString();
  const eventsRef = adminDb.collection("events");
  let evtLastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  while (true) {
    let evtQuery = eventsRef
      .where("timespanEnd", "<", nowISO)
      .orderBy("timespanEnd")
      .limit(BATCH_SIZE);

    if (evtLastDoc) {
      evtQuery = evtQuery.startAfter(evtLastDoc);
    }

    const evtSnapshot = await evtQuery.get();
    if (evtSnapshot.empty) break;

    evtLastDoc = evtSnapshot.docs[evtSnapshot.docs.length - 1];

    const batch = adminDb.batch();
    let batchCount = 0;
    for (const doc of evtSnapshot.docs) {
      if (doc.data().embedding != null) {
        batch.update(doc.ref, { embedding: FieldValue.delete() });
        batchCount++;
      }
    }
    if (batchCount > 0) {
      await batch.commit();
      totalCleaned += batchCount;
      console.log(`  Cleaned ${batchCount} events (total: ${totalCleaned})`);
    }

    if (evtSnapshot.size < BATCH_SIZE) break;
  }

  console.log(`\nDone. Removed embeddings from ${totalCleaned} expired documents.`);
}

cleanupEmbeddings().catch((error) => {
  console.error("Cleanup failed:", error);
  process.exit(1);
});
