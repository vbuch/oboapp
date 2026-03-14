import * as turf from "@turf/turf";
import type { GeoJSONFeatureCollection } from "@/lib/types";
import {
  LOCATION_WEIGHT,
  TIME_WEIGHT,
  CATEGORY_WEIGHT,
  CANDIDATE_DISTANCE_METERS,
} from "./constants";

export interface MatchSignals {
  locationSimilarity: number;
  timeOverlap: number;
  categoryMatch: number;
}

/**
 * Compute composite match score between a message and a candidate event.
 * Returns a score from 0 (no match) to 1 (perfect match) and the individual signals.
 */
export function computeMatchScore(
  message: {
    geoJson?: GeoJSONFeatureCollection | null;
    timespanStart?: string | Date | null;
    timespanEnd?: string | Date | null;
    categories?: string[];
    cityWide?: boolean;
  },
  event: {
    geometry?: GeoJSONFeatureCollection | null;
    timespanStart?: string | Date | null;
    timespanEnd?: string | Date | null;
    categories?: string[];
    cityWide?: boolean;
  },
): { score: number; signals: MatchSignals } {
  const locationSimilarity = computeLocationSimilarity(
    message.geoJson,
    event.geometry,
    message.cityWide,
    event.cityWide,
  );
  const timeOverlap = computeTimeOverlap(
    message.timespanStart,
    message.timespanEnd,
    event.timespanStart,
    event.timespanEnd,
  );
  const categoryMatch = computeCategoryMatch(
    message.categories,
    event.categories,
  );

  const score =
    LOCATION_WEIGHT * locationSimilarity +
    TIME_WEIGHT * timeOverlap +
    CATEGORY_WEIGHT * categoryMatch;

  return {
    score,
    signals: { locationSimilarity, timeOverlap, categoryMatch },
  };
}

/**
 * Location similarity: inverse of centroid distance.
 * 0 at ≥CANDIDATE_DISTANCE_METERS, 1 at 0m.
 * City-wide messages skip spatial comparison (returns 1.0 when both are city-wide).
 */
function computeLocationSimilarity(
  messageGeoJson: GeoJSONFeatureCollection | null | undefined,
  eventGeometry: GeoJSONFeatureCollection | null | undefined,
  messageCityWide?: boolean,
  eventCityWide?: boolean,
): number {
  // City-wide: spatial comparison not meaningful
  if (messageCityWide && eventCityWide) return 1.0;

  if (!messageGeoJson?.features?.length || !eventGeometry?.features?.length) {
    return 0;
  }

  const msgCentroid = turf.centroid(messageGeoJson);
  const evtCentroid = turf.centroid(eventGeometry);

  const distanceMeters =
    turf.distance(msgCentroid, evtCentroid, { units: "meters" });

  if (distanceMeters >= CANDIDATE_DISTANCE_METERS) return 0;
  return 1 - distanceMeters / CANDIDATE_DISTANCE_METERS;
}

/**
 * Temporal overlap: ratio of overlapping time to the union of both timespans.
 * Returns 1 if timespans are identical, 0 if no overlap.
 * If either timespan is missing, returns 0.
 */
function computeTimeOverlap(
  msgStart: string | Date | null | undefined,
  msgEnd: string | Date | null | undefined,
  evtStart: string | Date | null | undefined,
  evtEnd: string | Date | null | undefined,
): number {
  if (!msgStart || !msgEnd || !evtStart || !evtEnd) return 0;

  const ms = toMs(msgStart);
  const me = toMs(msgEnd);
  const es = toMs(evtStart);
  const ee = toMs(evtEnd);

  const overlapStart = Math.max(ms, es);
  const overlapEnd = Math.min(me, ee);
  const overlap = Math.max(0, overlapEnd - overlapStart);

  if (overlap === 0) return 0;

  const union = Math.max(me, ee) - Math.min(ms, es);
  if (union === 0) return 1; // identical instants

  return overlap / union;
}

/**
 * Category match: Jaccard similarity of category arrays.
 * Returns 0 if either array is empty (neutral — not a penalty).
 */
function computeCategoryMatch(
  msgCategories?: string[],
  evtCategories?: string[],
): number {
  const a = msgCategories ?? [];
  const b = evtCategories ?? [];

  if (a.length === 0 || b.length === 0) return 0;

  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;

  return intersection / union;
}

// toMs is imported from ./utils for DRY, but kept local here for zero-import
// overhead in the hot scoring path
function toMs(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}
