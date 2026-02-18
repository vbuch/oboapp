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

export interface LocalityMetadata {
  name: string; // Display name in the local language
  nameEn?: string; // English display name (optional)
  country: string; // Country code (e.g., "bg")
  description?: string; // Description text for manifest/meta tags
}

/**
 * Locality metadata registry - display names and descriptions
 */
export const LOCALITY_METADATA: Record<string, LocalityMetadata> = {
  "bg.sofia": {
    name: "София",
    nameEn: "Sofia",
    country: "bg",
    description: "Следи събитията в София",
  },
};

/**
 * Get metadata for a locality
 * @throws Error if locality is not found
 */
export function getLocalityMetadata(locality: string): LocalityMetadata {
  const metadata = LOCALITY_METADATA[locality];
  if (!metadata) {
    throw new Error(`Unknown locality: ${locality}. Valid localities: ${Object.keys(LOCALITY_METADATA).join(", ")}`);
  }
  return metadata;
}

/**
 * Get display name for a locality
 * @throws Error if locality is not found
 */
export function getLocalityName(locality: string): string {
  return getLocalityMetadata(locality).name;
}

/**
 * Get description for a locality (fallback to generic if not defined)
 * @throws Error if locality is not found
 */
export function getLocalityDescription(locality: string): string {
  const metadata = getLocalityMetadata(locality);
  return metadata.description || `Следи събитията в ${metadata.name}`;
}

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
