#!/usr/bin/env npx tsx

/**
 * Migration: Create 1:1 events from existing finalized messages.
 *
 * For every finalized message with geoJson, creates:
 * - An Event document (inherits geoJson, timespans, categories, text fields, etc.)
 * - An EventMessage link document (deterministic ID: messageId for idempotency)
 * - Updates the message with the eventId
 *
 * Idempotent: uses deterministic eventMessage IDs (doc ID = messageId).
 * Paginated: processes messages in batches to avoid loading entire collection.
 *
 * Run with: cd db && npx tsx migrate/2026-03-15-create-events-from-messages.ts
 */

import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve(process.cwd(), "../ingest/.env.local") });

const BATCH_SIZE = 200;

/** Source trust map (duplicated from ingest to avoid cross-package import) */
const SOURCE_GEOMETRY_QUALITY: Record<string, number> = {
  "toplo-bg": 3,
  "sofiyska-voda": 3,
  "erm-zapad": 3,
  "nimh-severe-weather": 3,
  "sofia-bg": 2,
  "rayon-oborishte-bg": 2,
  "mladost-bg": 2,
  "studentski-bg": 2,
  "sredec-sofia-org": 2,
  "so-slatina-org": 2,
  "lozenets-sofia-bg": 2,
  "raioniskar-bg": 2,
  "rayon-ilinden-bg": 2,
  "rayon-pancharevo-bg": 2,
};

function getGeometryQuality(source: string): number {
  return SOURCE_GEOMETRY_QUALITY[source] ?? 0;
}

/**
 * Convert a Firestore Timestamp to ISO string.
 * Handles { _seconds, _nanoseconds } shape and toDate() method.
 */
function convertTimestampToISO(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();

  if (typeof value === "object" && value !== null) {
    if (
      "toDate" in value &&
      typeof (value as Record<string, unknown>).toDate === "function"
    ) {
      return (value as { toDate(): Date }).toDate().toISOString();
    }
    if ("_seconds" in value) {
      const secs = (value as Record<string, number>)._seconds;
      return new Date(secs * 1000).toISOString();
    }
  }

  return null;
}

/**
 * Parse a JSON string field (geoJson, addresses are stored as strings in Firestore).
 */
function parseJsonField(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value ?? null;
}

async function main() {
  const { initializeApp, getApps, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");

  let adminDb: FirebaseFirestore.Firestore;
  if (!getApps().length) {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY!,
    );
    const app = initializeApp({ credential: cert(serviceAccount) });
    adminDb = getFirestore(app);
  } else {
    adminDb = getFirestore(getApps()[0]);
  }

  console.log("Starting migration: create events from messages...\n");

  let eventsCreated = 0;
  let skippedNoGeoJson = 0;
  let skippedNotFinalized = 0;
  let skippedAlreadyLinked = 0;
  let totalProcessed = 0;
  let lastDocId: string | undefined;

  // Paginate through messages using orderBy(__name__) + startAfter
  while (true) {
    let query = adminDb
      .collection("messages")
      .orderBy("__name__")
      .limit(BATCH_SIZE);

    if (lastDocId) {
      query = query.startAfter(lastDocId);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    let batch = adminDb.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      lastDocId = doc.id;
      totalProcessed++;
      const data = doc.data();
      const messageId = doc.id;

      if (!data.finalizedAt) {
        skippedNotFinalized++;
        continue;
      }

      const geoJson = parseJsonField(data.geoJson);
      if (!geoJson) {
        skippedNoGeoJson++;
        continue;
      }

      // Idempotent: use deterministic eventMessage ID = messageId
      const eventMessageRef = adminDb
        .collection("eventMessages")
        .doc(messageId);
      const existingLink = await eventMessageRef.get();

      if (existingLink.exists) {
        skippedAlreadyLinked++;
        continue;
      }

      const now = new Date().toISOString();
      const source = (data.source as string) || "";
      const geometryQuality = getGeometryQuality(source);

      // Create Event document — shape matches message closely
      const eventRef = adminDb.collection("events").doc();
      const eventData: Record<string, unknown> = {
        canonicalText: data.plainText || data.text || "",
        canonicalMarkdownText: data.markdownText || null,
        geoJson,
        geometryQuality,
        timespanStart: convertTimestampToISO(data.timespanStart),
        timespanEnd: convertTimestampToISO(data.timespanEnd),
        categories: data.categories || [],
        sources: source ? [source] : [],
        messageCount: 1,
        confidence: 1.0,
        locality: data.locality || "bg.sofia",
        cityWide: data.cityWide || false,
        embedding: data.embedding || null,
        createdAt: now,
        updatedAt: now,
      };
      batch.set(eventRef, eventData);

      // Create EventMessage link document (deterministic ID)
      const eventMessageData = {
        eventId: eventRef.id,
        messageId,
        source,
        confidence: 1.0,
        geometryQuality,
        matchSignals: null,
        createdAt: now,
      };
      batch.set(eventMessageRef, eventMessageData);

      // Store eventId on message
      batch.update(doc.ref, { eventId: eventRef.id });

      batchCount += 3;
      eventsCreated++;

      // Firestore batches can have at most 500 operations
      if (batchCount >= 498) {
        await batch.commit();
        console.log(`  Committed batch (${eventsCreated} events so far)...`);
        batch = adminDb.batch();
        batchCount = 0;
      }
    }

    // Commit remaining operations in this page
    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(
      `  Processed ${totalProcessed} messages (${eventsCreated} events created)...`,
    );

    // If we got fewer than BATCH_SIZE, we've reached the end
    if (snapshot.size < BATCH_SIZE) break;
  }

  console.log("\n✓ Migration completed successfully!");
  console.log(`  Total messages processed: ${totalProcessed}`);
  console.log(`  Events created: ${eventsCreated}`);
  console.log(`  Skipped (no geoJson): ${skippedNoGeoJson}`);
  console.log(`  Skipped (not finalized): ${skippedNotFinalized}`);
  console.log(`  Skipped (already linked): ${skippedAlreadyLinked}`);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
