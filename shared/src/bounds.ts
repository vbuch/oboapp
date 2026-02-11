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
 * Get bounds for a locality
 * @throws Error if locality is not found
 */
export function getBoundsForLocality(locality: string): BoundsDefinition {
  const bounds = BOUNDS[locality];
  if (!bounds) {
    throw new Error(`Unknown locality: ${locality}. Valid localities: ${Object.keys(BOUNDS).join(", ")}`);
  }
  return bounds;
}

/**
 * Get center for a locality
 * @throws Error if locality is not found
 */
export function getCenterForLocality(locality: string): CenterDefinition {
  const center = CENTERS[locality];
  if (!center) {
    throw new Error(`Unknown locality: ${locality}. Valid localities: ${Object.keys(CENTERS).join(", ")}`);
  }
  return center;
}

/**
 * Get bbox string for a locality
 * @throws Error if locality is not found
 */
export function getBboxForLocality(locality: string): string {
  const bounds = getBoundsForLocality(locality);
  return `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
}

/**
 * Check if coordinates are within a locality's boundaries
 * @param locality - Locality identifier (e.g., "bg.sofia")
 * @param lat - Latitude
 * @param lng - Longitude
 * @throws Error if locality is not found
 */
export function isWithinBounds(locality: string, lat: number, lng: number): boolean {
  const bounds = getBoundsForLocality(locality);
  return (
    lat >= bounds.south &&
    lat <= bounds.north &&
    lng >= bounds.west &&
    lng <= bounds.east
  );
}

/**
 * Validate that a locality exists
 * @throws Error if locality is invalid
 */
export function validateLocality(locality: string): void {
  if (!BOUNDS[locality]) {
    throw new Error(`Invalid locality: ${locality}. Valid localities: ${Object.keys(BOUNDS).join(", ")}`);
  }
}
