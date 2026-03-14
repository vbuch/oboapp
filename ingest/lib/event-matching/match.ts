import type { OboDb } from "@oboapp/db";
import type { GeoJSONFeatureCollection } from "@/lib/types";
import { findCandidateEvents } from "./candidates";
import { computeMatchScore } from "./score";
import { MATCH_THRESHOLD } from "./constants";

/**
 * Find the best matching event for a message, if any.
 * Returns the event and its match score, or null if no match above threshold.
 */
export async function findBestMatch(
  db: OboDb,
  message: {
    geoJson?: GeoJSONFeatureCollection | null;
    timespanStart?: string | Date | null;
    timespanEnd?: string | Date | null;
    categories?: string[];
    cityWide?: boolean;
    locality: string;
  },
): Promise<{
  event: Record<string, unknown>;
  score: number;
  signals: { locationSimilarity: number; timeOverlap: number; categoryMatch: number };
} | null> {
  const candidates = await findCandidateEvents(db, message);

  if (candidates.length === 0) return null;

  let bestMatch: {
    event: Record<string, unknown>;
    score: number;
    signals: { locationSimilarity: number; timeOverlap: number; categoryMatch: number };
  } | null = null;

  for (const candidate of candidates) {
    const { score, signals } = computeMatchScore(
      {
        geoJson: message.geoJson,
        timespanStart: message.timespanStart,
        timespanEnd: message.timespanEnd,
        categories: message.categories,
        cityWide: message.cityWide,
      },
      {
        geometry: candidate.geometry as GeoJSONFeatureCollection | null | undefined,
        timespanStart: candidate.timespanStart as string | null,
        timespanEnd: candidate.timespanEnd as string | null,
        categories: candidate.categories as string[] | undefined,
        cityWide: candidate.cityWide as boolean | undefined,
      },
    );

    if (score >= MATCH_THRESHOLD && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { event: candidate, score, signals };
    }
  }

  return bestMatch;
}
