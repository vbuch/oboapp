#!/usr/bin/env node
import dotenv from "dotenv";
import { resolve } from "node:path";

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function seedEmulator() {
  console.log("🌱 Seeding Firebase Emulator with test data...\n");

  // Dynamic import to ensure dotenv loads first
  const { adminDb } = await import("@/lib/firebase-admin");

  // Sample source documents
  const sources = [
    {
      id: "test-source-water-1",
      url: "https://example.com/water-disruption-1",
      sourceType: "rayon-oborishte-bg",
      title: "Спиране на водоснабдяването - бул. Витоша",
      text: "Спиране на водоснабдяването на бул. Витоша 1 поради авария от 10:00 до 16:00 часа на 15.02.2026г.",
      datePublished: "2026-02-01T08:00:00Z",
      crawledAt: new Date(),
      timespanStart: new Date("2026-02-15T10:00:00Z"),
      timespanEnd: new Date("2026-02-15T16:00:00Z"),
    },
    {
      id: "test-source-traffic-1",
      url: "https://example.com/traffic-block-1",
      sourceType: "sofia-bg",
      title: "Ограничение на движението - бул. Мария Луиза",
      text: "Затворен за движение булевард Мария Луиза от 8:00 до 18:00 часа поради ремонтни дейности.",
      datePublished: "2026-02-01T09:00:00Z",
      crawledAt: new Date(),
      timespanStart: new Date("2026-02-01T08:00:00Z"),
      timespanEnd: new Date("2026-02-01T18:00:00Z"),
    },
    {
      id: "test-source-construction-1",
      url: "https://example.com/metro-construction",
      sourceType: "sofia-bg",
      title: "Ремонт на метростанция",
      text: "Ремонт на метростанция на площад Македония до края на месеца.",
      datePublished: "2026-02-01T10:00:00Z",
      crawledAt: new Date(),
      timespanStart: new Date("2026-02-01T00:00:00Z"),
      timespanEnd: new Date("2026-02-28T23:59:59Z"),
    },
  ];

  console.log("📄 Creating source documents...");
  for (const source of sources) {
    await adminDb.collection("sources").doc(source.id).set(source);
    console.log(`  ✓ ${source.id}`);
  }

  // Sample message documents with GeoJSON
  const messages = [
    {
      id: "test-message-water-1",
      text: "Спиране на водоснабдяването на бул. Витоша 1 поради авария.",
      sourceDocumentId: "test-source-water-1",
      source: "rayon-oborishte-bg",
      sourceUrl: "https://example.com/water-disruption-1",
      categories: ["water"],
      relations: [],
      timespanStart: new Date("2026-02-15T10:00:00Z"),
      timespanEnd: new Date("2026-02-15T16:00:00Z"),
      markdownText:
        "**Спиране на водоснабдяването**\\n\\nАдрес: бул. Витоша 1\\nВреме: 10:00 - 16:00\\nДата: 15.02.2026",
      finalizedAt: new Date(),
      createdAt: new Date(),
    },
    {
      id: "test-message-traffic-1",
      text: "Затворен за движение булевард Мария Луиза.",
      sourceDocumentId: "test-source-traffic-1",
      source: "sofia-bg",
      sourceUrl: "https://example.com/traffic-block-1",
      categories: ["road-block", "traffic"],
      relations: [],
      timespanStart: new Date("2026-02-01T08:00:00Z"),
      timespanEnd: new Date("2026-02-01T18:00:00Z"),
      markdownText:
        "**Ограничение на движението**\\n\\nУлица: бул. Мария Луиза\\nВреме: 08:00 - 18:00",
      finalizedAt: new Date(),
      createdAt: new Date(),
    },
    {
      id: "test-message-construction-1",
      text: "Ремонт на метростанция на площад Македония.",
      sourceDocumentId: "test-source-construction-1",
      source: "sofia-bg",
      sourceUrl: "https://example.com/metro-construction",
      categories: ["construction-and-repairs", "public-transport"],
      relations: ["метро"],
      timespanStart: new Date("2026-02-01T00:00:00Z"),
      timespanEnd: new Date("2026-02-28T23:59:59Z"),
      markdownText:
        "**Ремонт на метростанция**\\n\\nМясто: площад Македония\\nПериод: до края на месеца",
      finalizedAt: new Date(),
      createdAt: new Date(),
    },
  ];

  console.log("\n💬 Creating message documents...");
  for (const message of messages) {
    await adminDb.collection("messages").doc(message.id).set(message);
    console.log(`  ✓ ${message.id}`);
  }

  // Sample interest zones
  const interests = [
    {
      id: "test-interest-1",
      userId: "test-user-1",
      name: "Център",
      coordinates: { lat: 42.6977, lng: 23.3219 },
      radius: 1000, // meters
      createdAt: new Date(),
    },
    {
      id: "test-interest-2",
      userId: "test-user-2",
      name: "Витоша",
      coordinates: { lat: 42.65, lng: 23.2833 },
      radius: 2000,
      createdAt: new Date(),
    },
  ];

  console.log("\n📍 Creating interest zones...");
  for (const interest of interests) {
    await adminDb.collection("interests").doc(interest.id).set(interest);
    console.log(`  ✓ ${interest.name} (user: ${interest.userId})`);
  }

  console.log("\n✅ Emulator seeding complete!");
  console.log("\n📊 Summary:");
  console.log(`   ${sources.length} source documents`);
  console.log(`   ${messages.length} message documents`);
  console.log(`   ${interests.length} interest zones`);
  console.log("\n💡 Access the Emulator UI at: http://localhost:4000");
}

seedEmulator().catch((error) => {
  console.error("❌ Error seeding emulator:", error);
  process.exit(1);
});
