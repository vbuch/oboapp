import type { OboDb } from "@oboapp/db";
import type { GeoJSONFeatureCollection } from "@/lib/types";
import { findCandidateEvents } from "./candidates";
import { computeMatchScore, type MatchSignals } from "./score";
import {
  PRE_GEOCODE_MATCH_THRESHOLD,
  MIN_REUSABLE_GEOMETRY_QUALITY,
  PRE_GEOCODE_TIME_WEIGHT,
  PRE_GEOCODE_CATEGORY_WEIGHT,
} from "./constants";

export interface PreGeocodeMatchResult {
  event: Record<string, unknown>;
  geometry: GeoJSONFeatureCollection;
  score: number;
  signals: MatchSignals;
}

/**
 * Attempt to match a message to an existing event BEFORE geocoding.
 * If a high-quality match is found, reuse the event's geometry and skip geocoding.
 *
 * Uses only time+category signals (no spatial comparison since geoJson doesn't exist yet).
 * Requires a higher threshold (0.80) and minimum geometry quality (≥2) on the event.
 *
 * Returns null if no suitable match found — caller should proceed with normal geocoding.
 */
export async function preGeocodeMatch(
  db: OboDb,
  message: {
    timespanStart?: string | Date | null;
    timespanEnd?: string | Date | null;
    categories?: string[];
    cityWide?: boolean;
    locality: string;
  },
): Promise<PreGeocodeMatchResult | null> {
  const candidates = await findCandidateEvents(db, message);

  if (candidates.length === 0) return null;

  let best: PreGeocodeMatchResult | null = null;

  for (const candidate of candidates) {
    const geometryQuality = (candidate.geometryQuality as number) ?? 0;

    // Skip events with low-quality geometry — not worth reusing
    if (geometryQuality < MIN_REUSABLE_GEOMETRY_QUALITY) continue;

    const geometry = candidate.geometry as GeoJSONFeatureCollection | undefined;
    if (!geometry?.features?.length) continue;

    // Score using time + category only (re-weighted since no location signal)
    const { signals } = computeMatchScore(
      {
        geoJson: null, // no geoJson yet
        timespanStart: message.timespanStart,
        timespanEnd: message.timespanEnd,
        categories: message.categories,
        cityWide: message.cityWide,
      },
      {
        geometry: candidate.geometry as GeoJSONFeatureCollection | null,
        timespanStart: candidate.timespanStart as string | null,
        timespanEnd: candidate.timespanEnd as string | null,
        categories: candidate.categories as string[] | undefined,
        cityWide: candidate.cityWide as boolean | undefined,
      },
    );

    // Re-weight without location signal: time and category only
    const score =
      PRE_GEOCODE_TIME_WEIGHT * signals.timeOverlap +
      PRE_GEOCODE_CATEGORY_WEIGHT * signals.categoryMatch;

    if (score >= PRE_GEOCODE_MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { event: candidate, geometry, score, signals };
    }
  }

  return best;
}
