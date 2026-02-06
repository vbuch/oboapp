import type { Firestore } from "firebase-admin/firestore";
import { Interest } from "@/lib/types";
import { convertTimestamp } from "./utils";
import { logger } from "@/lib/logger";

/**
 * Get all user interests
 */
export async function getAllInterests(adminDb: Firestore): Promise<Interest[]> {
  logger.info("Fetching user interests");

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

  logger.info("Found user interests", {
    count: interests.length,
    uniqueUsers: new Set(interests.map((i) => i.userId)).size,
  });

  return interests;
}
