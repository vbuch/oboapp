/**
 * Geographic bounds and viewport utilities
 */

import * as turf from "@turf/turf";
import type { GeoJSONFeature } from "@/lib/types";
import { BOUNDS, getBoundsForTarget } from "@oboapp/shared";

/**
 * Get target locality from environment variable
 * @throws Error if NEXT_PUBLIC_TARGET_LOCALITY is not set
 */
function getTargetLocality(): string {
  const target = process.env.NEXT_PUBLIC_TARGET_LOCALITY;
  if (!target) {
    throw new Error("NEXT_PUBLIC_TARGET_LOCALITY environment variable is required but not set");
  }
  return target;
}

/**
 * Get bounds for target locality
 */
function getTargetBounds() {
  const targetLocality = getTargetLocality();
  return getBoundsForTarget(targetLocality);
}

// Re-export BOUNDS for tests
export { BOUNDS };

export interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
  zoom?: number; // Optional for backward compatibility
}

/**
 * Clamp viewport bounds to target locality boundaries
 */
export function clampBounds(bounds: ViewportBounds): ViewportBounds {
  const targetBounds = getTargetBounds();
  return {
    north: Math.min(bounds.north, targetBounds.north),
    south: Math.max(bounds.south, targetBounds.south),
    east: Math.min(bounds.east, targetBounds.east),
    west: Math.max(bounds.west, targetBounds.west),
  };
}

/**
 * Add percentage-based buffer to viewport bounds
 * @param bounds - Original viewport bounds
 * @param bufferPercent - Buffer percentage (e.g., 0.2 for 20%)
 * @returns Buffered bounds clamped to target locality boundaries
 */
export function addBuffer(
  bounds: ViewportBounds,
  bufferPercent: number = 0.2,
): ViewportBounds {
  const targetBounds = getTargetBounds();
  const latBuffer = (bounds.north - bounds.south) * bufferPercent;
  const lngBuffer = (bounds.east - bounds.west) * bufferPercent;

  return {
    north: Math.min(bounds.north + latBuffer, targetBounds.north),
    south: Math.max(bounds.south - latBuffer, targetBounds.south),
    east: Math.min(bounds.east + lngBuffer, targetBounds.east),
    west: Math.max(bounds.west - lngBuffer, targetBounds.west),
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
