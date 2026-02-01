#!/usr/bin/env tsx
import dotenv from "dotenv";
import { resolve } from "node:path";
import { MESSAGE_CONFIGS, INTEREST_ZONES } from "./seed-emulator-fixtures";
import { seedTestUser, seedInterestZones } from "./seed-emulator-users";
import { seedSourcesAndMessages } from "./seed-emulator-messages";

// Load environment variables for emulator
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function seedEmulator() {
  console.log("🌱 Seeding Firebase Emulator with realistic test data...\n");

  // Dynamic import to ensure dotenv loads first
  const { adminDb } = await import("@/lib/firebase-admin");

  // Verify connection
  console.log("Verifying emulator connection...");
  const testDoc = await adminDb
    .collection("_test")
    .add({ timestamp: new Date() });
  await testDoc.delete();
  console.log("✅ Connected to emulator\n");

  try {
    await seedTestUser(adminDb);
    await seedInterestZones(adminDb);
    await seedSourcesAndMessages(adminDb);

    console.log("✨ Seeding complete!\n");
    console.log("📊 Summary:");
    console.log(`   - 1 test user`);
    console.log(`   - ${INTEREST_ZONES.length} interest zones`);
    console.log(`   - ${MESSAGE_CONFIGS.length} messages with GeoJSON`);
    console.log(`\n🗺️  View data at: http://localhost:4000`);
    console.log(`🌐 View map at: http://localhost:3000\n`);
  } catch (error) {
    console.error("❌ Error seeding emulator:", error);
    process.exit(1);
  }
}

seedEmulator().catch((error) => {
  console.error("❌ Error seeding emulator:", error);
  process.exit(1);
});
