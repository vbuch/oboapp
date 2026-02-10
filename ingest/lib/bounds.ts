/**
 * Geographic bounds for cities and regions
 * Supports multiple target locations
 */

export interface BoundsDefinition {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface CenterDefinition {
  lat: number;
  lng: number;
}

/**
 * Bounds registry - add new cities/regions here
 */
export const BOUNDS: Record<string, BoundsDefinition> = {
  "bg.sofia": {
    south: 42.605,
    west: 23.188,
    north: 42.83,
    east: 23.528,
  },
};

/**
 * Center coordinates registry
 */
export const CENTERS: Record<string, CenterDefinition> = {
  "bg.sofia": { lat: 42.6977, lng: 23.3219 },
};

/**
 * Legacy export for backward compatibility
 * @deprecated Use BOUNDS["bg.sofia"] instead
 */
export const SOFIA_BOUNDS = BOUNDS["bg.sofia"];

/**
 * Legacy export for backward compatibility
 * @deprecated Use CENTERS["bg.sofia"] instead
 */
export const SOFIA_CENTER = CENTERS["bg.sofia"];

/**
 * Sofia bounding box in bbox format (south,west,north,east)
 * Used by Overpass API queries
 * @deprecated Use getBboxForTarget("bg.sofia") instead
 */
export const SOFIA_BBOX = `${SOFIA_BOUNDS.south},${SOFIA_BOUNDS.west},${SOFIA_BOUNDS.north},${SOFIA_BOUNDS.east}`;

/**
 * Get bounds for a target
 * @throws Error if target is not found
 */
export function getBoundsForTarget(target: string): BoundsDefinition {
  const bounds = BOUNDS[target];
  if (!bounds) {
    throw new Error(`Unknown target: ${target}. Valid targets: ${Object.keys(BOUNDS).join(", ")}`);
  }
  return bounds;
}

/**
 * Get center for a target
 * @throws Error if target is not found
 */
export function getCenterForTarget(target: string): CenterDefinition {
  const center = CENTERS[target];
  if (!center) {
    throw new Error(`Unknown target: ${target}. Valid targets: ${Object.keys(CENTERS).join(", ")}`);
  }
  return center;
}

/**
 * Get bbox string for a target
 * @throws Error if target is not found
 */
export function getBboxForTarget(target: string): string {
  const bounds = getBoundsForTarget(target);
  return `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
}

/**
 * Check if coordinates are within target's boundaries
 * @throws Error if target is not found
 */
export function isWithinTarget(target: string, lat: number, lng: number): boolean {
  const bounds = getBoundsForTarget(target);
  return (
    lat >= bounds.south &&
    lat <= bounds.north &&
    lng >= bounds.west &&
    lng <= bounds.east
  );
}

/**
 * Check if coordinates are within Sofia's administrative boundaries
 * @deprecated Use isWithinTarget("bg.sofia", lat, lng) instead
 */
export function isWithinSofia(lat: number, lng: number): boolean {
  return isWithinTarget("bg.sofia", lat, lng);
}

/**
 * Validate that a target exists
 * @throws Error if target is invalid
 */
export function validateTarget(target: string): void {
  if (!BOUNDS[target]) {
    throw new Error(`Invalid target: ${target}. Valid targets: ${Object.keys(BOUNDS).join(", ")}`);
  }
}
