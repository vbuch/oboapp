import type { OboDb } from "@oboapp/db";
import { Interest } from "@/lib/types";
import { logger } from "@/lib/logger";

function toDateOrString(value: unknown): Date | string {
  if (value instanceof Date) return value;
  if (typeof value === "string") return value;
  return new Date();
}

/**
 * Get all user interests
 */
export async function getAllInterests(db: OboDb): Promise<Interest[]> {
  logger.info("Fetching user interests");

  const docs = await db.interests.findMany();

  const interests: Interest[] = docs.map((data) => ({
    id: data._id as string,
    userId: data.userId as string,
    coordinates: data.coordinates as Interest["coordinates"],
    radius: data.radius as number,
    label: (data.label as string | undefined),
    color: (data.color as string | undefined),
    createdAt: toDateOrString(data.createdAt),
    updatedAt: toDateOrString(data.updatedAt),
  }));

  logger.info("Found user interests", {
    count: interests.length,
    uniqueUsers: new Set(interests.map((i) => i.userId)).size,
  });

  return interests;
}
