import type { Firestore } from "firebase-admin/firestore";
import { INTEREST_ZONES } from "./seed-emulator-fixtures";

export async function seedTestUser(db: Firestore): Promise<void> {
  console.log("Creating test users...");
  await db
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
}

export async function seedInterestZones(db: Firestore): Promise<void> {
  console.log("Creating interest zones...");

  for (let i = 0; i < INTEREST_ZONES.length; i++) {
    const zone = INTEREST_ZONES[i];
    await db
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
  console.log(`✅ Created ${INTEREST_ZONES.length} interest zones\n`);
}
