#!/usr/bin/env node
import dotenv from "dotenv";
import { resolve } from "node:path";
import { faker } from "@faker-js/faker";

// Load environment variables for emulator
dotenv.config({ path: resolve(process.cwd(), ".env.emulator") });

// Sofia coordinates boundary
const SOFIA_BOUNDS = {
  north: 42.75,
  south: 42.65,
  east: 23.42,
  west: 23.22,
};

// Helper to generate random point within Sofia
function randomSofiaPoint() {
  return {
    lat: faker.number.float({
      min: SOFIA_BOUNDS.south,
      max: SOFIA_BOUNDS.north,
      fractionDigits: 6,
    }),
    lng: faker.number.float({
      min: SOFIA_BOUNDS.west,
      max: SOFIA_BOUNDS.east,
      fractionDigits: 6,
    }),
  };
}

// Helper to create GeoJSON Point
function createPointGeoJson(lat: number, lng: number) {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [lng, lat], // GeoJSON is [lng, lat]
        },
        properties: {}, // Empty properties to avoid Firestore nested entity errors
      },
    ],
  };
}

// Helper to create GeoJSON LineString
function createLineGeoJson(points: Array<{ lat: number; lng: number }>) {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: points.map((p) => [p.lng, p.lat]),
        },
        properties: {}, // Empty properties to avoid Firestore nested entity errors
      },
    ],
  };
}

const CATEGORIES = [
  "water",
  "electricity",
  "heating",
  "road-block",
  "traffic",
  "construction-and-repairs",
  "public-transport",
];

const SOFIA_STREETS = [
  "бул. Витоша",
  "бул. Мария Луиза",
  "бул. Цар Освободител",
  "ул. Граф Игнатиев",
  "бул. Сливница",
  "ул. Раковски",
  "бул. Драган Цанков",
];

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
    // Create test users
    console.log("Creating test users...");
    await adminDb
      .collection("users")
      .doc("test-user-1")
      .set({
        email: "test@example.com",
        createdAt: new Date(),
        settings: {
          notifications: {
            enabled: true,
          },
        },
      });
    console.log("✅ Created test user\n");

    // Create user interest zones
    console.log("Creating interest zones...");
    const zones = [
      {
        name: "Центъра",
        center: { lat: 42.6977, lng: 23.3219 }, // Sofia center
      },
      {
        name: "Младост",
        center: { lat: 42.6476, lng: 23.3768 },
      },
      {
        name: "Студентски град",
        center: { lat: 42.6558, lng: 23.3518 },
      },
    ];

    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i];
      await adminDb
        .collection("users")
        .doc("test-user-1")
        .collection("interestZones")
        .doc(`zone-${i + 1}`)
        .set({
          name: zone.name,
          center: zone.center,
          radius: 1000,
          createdAt: new Date(),
        });
    }
    console.log(`✅ Created ${zones.length} interest zones\n`);

    // Create sources and messages with realistic data
    console.log("Creating sources and messages...");

    const messageConfigs = [
      // Water outages (Points)
      {
        category: ["water"],
        type: "point",
        street: faker.helpers.arrayElement(SOFIA_STREETS),
        text: "Планирано прекъсване на водоподаването",
      },
      {
        category: ["water"],
        type: "point",
        street: faker.helpers.arrayElement(SOFIA_STREETS),
        text: "Авария на водопровод",
      },
      // Heating (Points)
      {
        category: ["heating"],
        type: "point",
        street: faker.helpers.arrayElement(SOFIA_STREETS),
        text: "Ремонт на топлопровод",
      },
      {
        category: ["heating"],
        type: "point",
        street: faker.helpers.arrayElement(SOFIA_STREETS),
        text: "Подмяна на участък от топлопреносната мрежа",
      },
      // Electricity (Points)
      {
        category: ["electricity"],
        type: "point",
        street: faker.helpers.arrayElement(SOFIA_STREETS),
        text: "Планирано изключване на електроподаването",
      },
      // Road blocks (LineStrings)
      {
        category: ["road-block", "construction-and-repairs"],
        type: "line",
        street: faker.helpers.arrayElement(SOFIA_STREETS),
        text: "Ремонт на пътно платно, затруднено движение",
      },
      {
        category: ["road-block"],
        type: "line",
        street: faker.helpers.arrayElement(SOFIA_STREETS),
        text: "Временно затваряне на участък",
      },
      // Traffic
      {
        category: ["traffic"],
        type: "line",
        street: faker.helpers.arrayElement(SOFIA_STREETS),
        text: "Интензивен трафик",
      },
      // Construction
      {
        category: ["construction-and-repairs"],
        type: "point",
        street: faker.helpers.arrayElement(SOFIA_STREETS),
        text: "Строително-ремонтни дейности",
      },
      {
        category: ["construction-and-repairs"],
        type: "point",
        street: faker.helpers.arrayElement(SOFIA_STREETS),
        text: "Подмяна на водопроводна инсталация",
      },
      // Public transport
      {
        category: ["public-transport"],
        type: "line",
        street: faker.helpers.arrayElement(SOFIA_STREETS),
        text: "Променен маршрут на автобусна линия",
      },
      {
        category: ["public-transport"],
        type: "point",
        street: faker.helpers.arrayElement(SOFIA_STREETS),
        text: "Временна автобусна спирка",
      },
      // Mixed categories
      {
        category: ["water", "construction-and-repairs"],
        type: "point",
        street: faker.helpers.arrayElement(SOFIA_STREETS),
        text: "Ремонт на водопроводна мрежа",
      },
      {
        category: ["road-block", "traffic"],
        type: "line",
        street: faker.helpers.arrayElement(SOFIA_STREETS),
        text: "Пътни ремонти с ограничение на движението",
      },
      {
        category: ["heating", "construction-and-repairs"],
        type: "point",
        street: faker.helpers.arrayElement(SOFIA_STREETS),
        text: "Реконструкция на топлопровод",
      },
      // Future events
      {
        category: ["water"],
        type: "point",
        street: faker.helpers.arrayElement(SOFIA_STREETS),
        text: "Планирани профилактични дейности",
      },
      {
        category: ["electricity"],
        type: "point",
        street: faker.helpers.arrayElement(SOFIA_STREETS),
        text: "Профилактика на електроразпределителната мрежа",
      },
      // Past events
      {
        category: ["road-block"],
        type: "line",
        street: faker.helpers.arrayElement(SOFIA_STREETS),
        text: "Приключили ремонтни дейности",
      },
    ];

    for (let i = 0; i < messageConfigs.length; i++) {
      const config = messageConfigs[i];
      const sourceId = `test-source-${i + 1}`;
      const messageId = `test-message-${i + 1}`;

      // Generate timespan - ensure all messages are within 7-day relevance window
      let timespanStart: Date;
      let timespanEnd: Date;
      const now = new Date();

      if (i < 6) {
        // Current/ongoing events (started 1-2 days ago, ends in 1-5 days)
        timespanStart = new Date(
          now.getTime() -
            faker.number.int({ min: 1, max: 2 }) * 24 * 60 * 60 * 1000,
        );
        timespanEnd = new Date(
          now.getTime() +
            faker.number.int({ min: 1, max: 5 }) * 24 * 60 * 60 * 1000,
        );
      } else if (i < 15) {
        // Future events (starts in 1-2 days, lasts 1-3 days)
        timespanStart = new Date(
          now.getTime() +
            faker.number.int({ min: 1, max: 2 }) * 24 * 60 * 60 * 1000,
        );
        timespanEnd = new Date(
          timespanStart.getTime() +
            faker.number.int({ min: 1, max: 3 }) * 24 * 60 * 60 * 1000,
        );
      } else {
        // Recently ended events (ended 0-2 days ago)
        timespanEnd = new Date(
          now.getTime() -
            faker.number.int({ min: 0, max: 2 }) * 24 * 60 * 60 * 1000,
        );
        timespanStart = new Date(
          timespanEnd.getTime() -
            faker.number.int({ min: 1, max: 3 }) * 24 * 60 * 60 * 1000,
        );
      }

      // Create source document
      const sourceData = {
        url: `https://example.com/source/${i + 1}`,
        title: `${config.text} на ${config.street}`,
        text: `${config.text} на ${config.street} от ${timespanStart.toLocaleDateString("bg-BG")} до ${timespanEnd.toLocaleDateString("bg-BG")}`,
        createdAt: new Date(),
        timespanStart: timespanStart,
        timespanEnd: timespanEnd,
      };

      await adminDb.collection("sources").doc(sourceId).set(sourceData);

      // Create GeoJSON based on type
      let geoJson;
      let point;

      if (config.type === "point") {
        point = randomSofiaPoint();
        geoJson = createPointGeoJson(point.lat, point.lng);
      } else {
        // LineString with 3-5 points
        const numPoints = faker.number.int({ min: 3, max: 5 });
        const points = [];
        const startPoint = randomSofiaPoint();
        points.push(startPoint);

        for (let j = 1; j < numPoints; j++) {
          // Create nearby points (small offset)
          points.push({
            lat:
              startPoint.lat +
              faker.number.float({ min: -0.01, max: 0.01, fractionDigits: 6 }),
            lng:
              startPoint.lng +
              faker.number.float({ min: -0.01, max: 0.01, fractionDigits: 6 }),
          });
        }

        geoJson = createLineGeoJson(points);
        point = startPoint; // Use first point as reference
      }

      // Create message document
      const messageData = {
        sourceDocumentId: sourceId,
        text: `${config.text} на ${config.street}`,
        markdownText: `**${config.text}**\n\nЛокация: ${config.street}\n\nПериод: ${timespanStart.toLocaleDateString("bg-BG")} - ${timespanEnd.toLocaleDateString("bg-BG")}`,
        categories: config.category,
        createdAt: new Date(),
        finalizedAt: new Date(),
        timespanStart: timespanStart,
        timespanEnd: timespanEnd,
        geoJson: JSON.stringify(geoJson), // Firestore requires GeoJSON as string
      };

      await adminDb.collection("messages").doc(messageId).set(messageData);
    }

    console.log(`✅ Created ${messageConfigs.length} sources and messages\n`);

    console.log("✨ Seeding complete!\n");
    console.log("📊 Summary:");
    console.log(`   - 1 test user`);
    console.log(`   - ${zones.length} interest zones`);
    console.log(`   - ${messageConfigs.length} messages with GeoJSON`);
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
