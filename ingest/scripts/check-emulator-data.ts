#!/usr/bin/env tsx
import dotenv from "dotenv";
import { resolve } from "node:path";

// Load emulator environment
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function checkData() {
  console.log("Environment:");
  console.log("  USE_FIREBASE_EMULATORS:", process.env.USE_FIREBASE_EMULATORS);
  console.log(
    "  FIRESTORE_EMULATOR_HOST:",
    process.env.FIRESTORE_EMULATOR_HOST,
  );
  console.log(
    "  NEXT_PUBLIC_FIREBASE_PROJECT_ID:",
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  );
  console.log();

  const { adminDb } = await import("@/lib/firebase-admin");

  console.log("Checking collections...\n");

  // Check users
  const usersSnap = await adminDb.collection("users").get();
  console.log(`Users: ${usersSnap.size} documents`);

  // Check sources
  const sourcesSnap = await adminDb.collection("sources").get();
  console.log(`Sources: ${sourcesSnap.size} documents`);

  // Check messages
  const messagesSnap = await adminDb.collection("messages").get();
  console.log(`Messages: ${messagesSnap.size} documents`);

  if (messagesSnap.size > 0) {
    console.log("\nSample messages:");
    const now = new Date();
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let withinWindow = 0;
    let outsideWindow = 0;

    messagesSnap.docs.slice(0, 5).forEach((doc, idx) => {
      const data = doc.data();
      const timespanEnd = data.timespanEnd ? new Date(data.timespanEnd) : null;
      const isValid =
        timespanEnd && !isNaN(timespanEnd.getTime()) && timespanEnd >= cutoff;

      if (isValid) withinWindow++;
      else outsideWindow++;

      console.log(`  ${idx + 1}. ${doc.id}`);
      console.log(`     Categories: ${data.categories?.join(", ") || "none"}`);
      console.log(
        `     Timespan End: ${timespanEnd && !isNaN(timespanEnd.getTime()) ? timespanEnd.toISOString() : "invalid/missing"}`,
      );
      console.log(`     Within 7-day window: ${isValid ? "✅ YES" : "❌ NO"}`);
    });

    console.log(`\nTimespan validation (first 5):`);
    console.log(`  Within 7-day window: ${withinWindow}`);
    console.log(`  Outside window: ${outsideWindow}`);
    console.log(`  Cutoff date: ${cutoff.toISOString()}`);
  }
}

checkData().catch(console.error);
