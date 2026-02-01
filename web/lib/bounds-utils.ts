/**
 * Geographic bounds and viewport utilities for Sofia, Bulgaria
 */

import * as turf from "@turf/turf";
import type { GeoJSONFeature } from "@/lib/types";

// Sofia bounding box (matches ingest/lib/geocoding-utils.ts)
export const SOFIA_BOUNDS = {
  south: 42.605,
  west: 23.188,
  north: 42.83,
  east: 23.528,
};

export interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
  zoom?: number; // Optional for backward compatibility
}

/**
 * Clamp viewport bounds to Sofia city boundaries
 */
export function clampBounds(bounds: ViewportBounds): ViewportBounds {
  return {
    north: Math.min(bounds.north, SOFIA_BOUNDS.north),
    south: Math.max(bounds.south, SOFIA_BOUNDS.south),
    east: Math.min(bounds.east, SOFIA_BOUNDS.east),
    west: Math.max(bounds.west, SOFIA_BOUNDS.west),
  };
}

/**
 * Add percentage-based buffer to viewport bounds
 * @param bounds - Original viewport bounds
 * @param bufferPercent - Buffer percentage (e.g., 0.2 for 20%)
 * @returns Buffered bounds clamped to Sofia boundaries
 */
export function addBuffer(
  bounds: ViewportBounds,
  bufferPercent: number = 0.2,
): ViewportBounds {
  const latBuffer = (bounds.north - bounds.south) * bufferPercent;
  const lngBuffer = (bounds.east - bounds.west) * bufferPercent;

  return {
    north: Math.min(bounds.north + latBuffer, SOFIA_BOUNDS.north),
    south: Math.max(bounds.south - latBuffer, SOFIA_BOUNDS.south),
    east: Math.min(bounds.east + lngBuffer, SOFIA_BOUNDS.east),
    west: Math.max(bounds.west - lngBuffer, SOFIA_BOUNDS.west),
  };
}

/**
 * Check if a GeoJSON feature's bounding box intersects with viewport bounds
 */
export function featureIntersectsBounds(
  feature: GeoJSONFeature,
  bounds: ViewportBounds,
): boolean {
  if (!feature.geometry?.coordinates) return false;

  try {
    // Wrap geometry in a proper feature for Turf.js if needed
    const turfFeature =
      feature.type === "Feature" ? feature : turf.feature(feature.geometry);

    // Use Turf.js to calculate feature bounding box [minX, minY, maxX, maxY]
    const [minLng, minLat, maxLng, maxLat] = turf.bbox(turfFeature);

    // Check if bounding boxes overlap
    return !(
      (
        maxLat < bounds.south || // feature is completely below
        minLat > bounds.north || // feature is completely above
        maxLng < bounds.west || // feature is completely to the left
        minLng > bounds.east
      ) // feature is completely to the right
    );
  } catch (error) {
    // If bbox calculation fails, exclude the feature to be safe
    console.warn("⚠️  Failed to calculate feature bbox:", error);
    return false;
  }
}
