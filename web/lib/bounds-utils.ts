/**
 * Geographic bounds and viewport utilities
 */

import * as turf from "@turf/turf";
import type { GeoJSONFeature } from "@/lib/types";

// Bounds registry - supports multiple targets
export const BOUNDS: Record<string, {
  south: number;
  west: number;
  north: number;
  east: number;
}> = {
  "bg.sofia": {
    south: 42.605,
    west: 23.188,
    north: 42.83,
    east: 23.528,
  },
};

/**
 * Get target city from environment variable (defaults to bg.sofia)
 */
function getTargetCity(): string {
  return process.env.NEXT_PUBLIC_TARGET_CITY || "bg.sofia";
}

/**
 * Get bounds for target city
 */
function getTargetBounds() {
  const targetCity = getTargetCity();
  const bounds = BOUNDS[targetCity];
  if (!bounds) {
    throw new Error(`Unknown target: ${targetCity}. Valid targets: ${Object.keys(BOUNDS).join(", ")}`);
  }
  return bounds;
}

export interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
  zoom?: number; // Optional for backward compatibility
}

/**
 * Clamp viewport bounds to target city boundaries
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
 * @returns Buffered bounds clamped to target city boundaries
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
