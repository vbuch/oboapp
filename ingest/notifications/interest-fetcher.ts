import type { Firestore } from "firebase-admin/firestore";
import { Interest } from "@/lib/types";
import { convertTimestamp } from "./utils";

/**
 * Get all user interests
 */
export async function getAllInterests(adminDb: Firestore): Promise<Interest[]> {
  console.log("📍 Fetching user interests...");

  const interestsRef = adminDb.collection("interests");
  const snapshot = await interestsRef.get();

  const interests: Interest[] = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    interests.push({
      id: doc.id,
      userId: data.userId,
      coordinates: data.coordinates,
      radius: data.radius,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    });
  });

  console.log(
    `   ✅ Found ${interests.length} interests from ${
      new Set(interests.map((i) => i.userId)).size
    } users`,
  );

  return interests;
}
