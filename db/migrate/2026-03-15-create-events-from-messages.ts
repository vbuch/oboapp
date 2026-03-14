#!/usr/bin/env npx tsx

/**
 * Migration: Create 1:1 events from existing finalized messages.
 *
 * For every finalized message with geoJson, creates:
 * - An Event document (inherits geometry, timespans, categories, etc.)
 * - An EventMessage link document
 *
 * Idempotent: skips messages that already have an eventMessage link.
 *
 * Run with: cd db && npx tsx migrate/2026-03-15-create-events-from-messages.ts
 */

import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve(process.cwd(), "../ingest/.env.local") });

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

  const messagesSnapshot = await adminDb.collection("messages").get();
  console.log(`Found ${messagesSnapshot.size} total messages`);

  let eventsCreated = 0;
  let skippedNoGeoJson = 0;
  let skippedNotFinalized = 0;
  let skippedAlreadyLinked = 0;
  let batchCount = 0;
  let batch = adminDb.batch();

  for (const doc of messagesSnapshot.docs) {
    const data = doc.data();
    const messageId = doc.id;

    // Skip messages without geoJson or finalizedAt
    if (!data.geoJson) {
      skippedNoGeoJson++;
      continue;
    }
    if (!data.finalizedAt) {
      skippedNotFinalized++;
      continue;
    }

    // Idempotent: check if eventMessage already exists for this message
    const existingLink = await adminDb
      .collection("eventMessages")
      .where("messageId", "==", messageId)
      .limit(1)
      .get();

    if (!existingLink.empty) {
      skippedAlreadyLinked++;
      continue;
    }

    const now = new Date().toISOString();
    const source = (data.source as string) || "";
    const geometryQuality = getGeometryQuality(source);

    // Create Event document
    const eventRef = adminDb.collection("events").doc();
    const eventData = {
      canonicalText: data.plainText || data.text || "",
      canonicalMarkdownText: data.markdownText || null,
      geometry: data.geoJson,
      geometryQuality,
      timespanStart: data.timespanStart || null,
      timespanEnd: data.timespanEnd || null,
      categories: data.categories || [],
      sources: source ? [source] : [],
      messageCount: 1,
      confidence: 1.0,
      locality: data.locality || "bg.sofia",
      cityWide: data.cityWide || false,
      createdAt: now,
      updatedAt: now,
    };
    batch.set(eventRef, eventData);

    // Create EventMessage link document
    const eventMessageRef = adminDb.collection("eventMessages").doc();
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

    batchCount += 3; // 3 writes per message (event + eventMessage + message update)
    eventsCreated++;

    // Firestore batches can have at most 500 operations
    if (batchCount >= 498) {
      await batch.commit();
      console.log(`  Committed batch (${eventsCreated} events so far)...`);
      batch = adminDb.batch();
      batchCount = 0;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log("\n✓ Migration completed successfully!");
  console.log(`  Events created: ${eventsCreated}`);
  console.log(`  Skipped (no geoJson): ${skippedNoGeoJson}`);
  console.log(`  Skipped (not finalized): ${skippedNotFinalized}`);
  console.log(`  Skipped (already linked): ${skippedAlreadyLinked}`);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
