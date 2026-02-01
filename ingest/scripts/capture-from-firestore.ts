#!/usr/bin/env tsx
/**
 * Capture API fixtures from real Firestore messages
 * Replays actual source documents through the pipeline to capture real API responses
 */

import dotenv from "dotenv";
import { resolve } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";

// Load environment first
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  console.log("🔄 Capturing API fixtures from Firestore messages...\n");

  // Dynamic imports to ensure dotenv loads first
  const { adminDb } = await import("@/lib/firebase-admin");
  const { categorize, extractStructuredData } =
    await import("@/lib/ai-service");
  const { geocodeAddress } = await import("@/lib/geocoding-service");
  const { overpassGeocodeAddresses } =
    await import("@/lib/overpass-geocoding-service");
  const { geocodeCadastralProperty } =
    await import("@/lib/cadastre-geocoding-service");

  // Helper to write fixtures
  const writeFixture = (path: string, data: any) => {
    const fixtureBase = resolve(__dirname, "../__mocks__/fixtures");
    const fullPath = resolve(fixtureBase, path);
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, JSON.stringify(data, null, 2));
  };

  // Find a message with busStops for categorization
  console.log("🚏 Finding message with busStops...");
  const recentMessages = await adminDb
    .collection("messages")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const msgWithBusStops = recentMessages.docs.find((doc) => {
    const data = doc.data();
    return (
      data.categorize?.busStops &&
      Array.isArray(data.categorize.busStops) &&
      data.categorize.busStops.length > 0
    );
  });

  if (msgWithBusStops) {
    const msg = msgWithBusStops.data();
    console.log(`  Found message: ${msgWithBusStops.id}`);
    console.log(`  Source: ${msg.source}`);
    console.log(
      `  BusStops: ${msg.categorize?.busStops?.join(", ") || "none"}`,
    );

    if (msg.sourceDocumentId && msg.source) {
      const sourceDoc = await adminDb
        .collection("sources")
        .doc(msg.source)
        .collection("documents")
        .doc(msg.sourceDocumentId)
        .get();

      if (sourceDoc.exists) {
        const sourceData = sourceDoc.data();
        console.log(`  Re-categorizing source text...`);
        const categorizeResult = await categorize(sourceData?.text || msg.text);
        writeFixture("gemini/categorize-with-busstops.json", categorizeResult);
        console.log("  ✓ Saved categorize-with-busstops.json");
      }
    }
  } else {
    console.log("  ⚠️  No messages with busStops found in recent 50 messages");
  }

  // Find a message with cadastralProperties
  console.log("\n🏘️  Finding message with cadastral properties...");
  const msgWithCadastral = recentMessages.docs.find((doc) => {
    const data = doc.data();
    return (
      data.extractedData?.cadastralProperties &&
      Array.isArray(data.extractedData.cadastralProperties) &&
      data.extractedData.cadastralProperties.length > 0
    );
  });

  if (msgWithCadastral) {
    const msg = msgWithCadastral.data();
    console.log(`  Found message: ${msgWithCadastral.id}`);
    console.log(
      `  Cadastral properties: ${msg.extractedData?.cadastralProperties?.length || 0}`,
    );

    if (msg.categorize?.normalizedText) {
      console.log(`  Extracting data...`);
      const extracted = await extractStructuredData(
        msg.categorize.normalizedText,
      );
      writeFixture("gemini/extract-with-cadastral.json", extracted);
      console.log("  ✓ Saved extract-with-cadastral.json");

      // Geocode first cadastral property
      if (
        extracted &&
        extracted.cadastralProperties &&
        extracted?.cadastralProperties?.length > 0
      ) {
        const cadastralId = extracted.cadastralProperties[0].identifier;
        console.log(`  Geocoding cadastral: ${cadastralId}...`);
        try {
          const cadastralGeo = await geocodeCadastralProperty(cadastralId);
          writeFixture("cadastre/property-geometry-real.json", cadastralGeo);
          console.log("  ✓ Saved property-geometry-real.json");
        } catch (error: any) {
          console.log(`  ⚠️  Cadastre geocoding failed: ${error.message}`);
        }
      }
    }
  }

  // Find a message with street sections
  console.log("\n🛣️  Finding message with street sections...");
  const msgWithStreets = recentMessages.docs.find((doc) => {
    const data = doc.data();
    return (
      data.extractedData?.streets &&
      Array.isArray(data.extractedData.streets) &&
      data.extractedData.streets.length > 0
    );
  });

  if (msgWithStreets) {
    const msg = msgWithStreets.data();
    console.log(`  Found message: ${msgWithStreets.id}`);
    console.log(`  Streets: ${msg.extractedData?.streets?.length || 0}`);

    if (msg.extractedData?.streets && msg.extractedData.streets.length > 0) {
      const street = msg.extractedData.streets[0];
      const streetName = street.street;
      console.log(`  Geocoding street: ${streetName}...`);
      try {
        const streetGeo = await overpassGeocodeAddresses([streetName]);
        writeFixture("overpass/street-geometry-real.json", streetGeo);
        console.log("  ✓ Saved street-geometry-real.json");
      } catch (error: any) {
        console.log(`  ⚠️  Overpass geocoding failed: ${error.message}`);
      }

      // Try intersection if available
      if (street.intersections && street.intersections.length > 0) {
        const intersection = `${streetName} ∩ ${street.intersections[0]}`;
        console.log(`  Geocoding intersection: ${intersection}...`);
        try {
          const intersectionGeo = await overpassGeocodeAddresses([
            intersection,
          ]);
          writeFixture("overpass/intersection-real.json", intersectionGeo);
          console.log("  ✓ Saved intersection-real.json");
        } catch (error: any) {
          console.log(`  ⚠️  Intersection geocoding failed: ${error.message}`);
        }
      }
    }
  }

  // Find a message with pins (addresses)
  console.log("\n📍 Finding message with pins (addresses)...");
  const msgWithPins = recentMessages.docs.find((doc) => {
    const data = doc.data();
    return (
      data.extractedData?.pins &&
      Array.isArray(data.extractedData.pins) &&
      data.extractedData.pins.length > 0
    );
  });

  if (msgWithPins) {
    const msg = msgWithPins.data();
    console.log(`  Found message: ${msgWithPins.id}`);
    console.log(`  Pins: ${msg.extractedData?.pins?.length || 0}`);

    if (msg.extractedData?.pins && msg.extractedData.pins.length > 0) {
      const pin = msg.extractedData.pins[0];
      const address = pin.address;
      console.log(`  Geocoding address: ${address}...`);
      try {
        const addressGeo = await geocodeAddress(address);
        writeFixture("google-geocoding/valid-address-real.json", addressGeo);
        console.log("  ✓ Saved valid-address-real.json");
      } catch (error: any) {
        console.log(`  ⚠️  Google geocoding failed: ${error.message}`);
      }
    }
  }

  console.log("\n✅ Fixture capture from Firestore complete!");
  console.log("📁 Fixtures saved to: ingest/__mocks__/fixtures/");
  console.log(
    "\n💡 Review the generated fixtures and copy them over the placeholder files",
  );
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
