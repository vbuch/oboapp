/**
 * Geographic bounds for localities
 * Shared between ingest and web packages
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
 * Bounds registry - add new localities here
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
 * @param target - Target identifier (e.g., "bg.sofia")
 * @param lat - Latitude
 * @param lng - Longitude
 * @throws Error if target is not found
 */
export function isWithinBounds(target: string, lat: number, lng: number): boolean {
  const bounds = getBoundsForTarget(target);
  return (
    lat >= bounds.south &&
    lat <= bounds.north &&
    lng >= bounds.west &&
    lng <= bounds.east
  );
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
