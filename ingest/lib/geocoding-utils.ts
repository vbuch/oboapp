/**
 * Shared utilities for geocoding services
 */

// Sofia bounding box (approximate administrative boundaries)
// southwest: [23.188, 42.605], northeast: [23.528, 42.788]
export const SOFIA_BOUNDS = {
  south: 42.605,
  west: 23.188,
  north: 42.83,
  east: 23.528,
};

/**
 * Sofia city center coordinates (used as reference point)
 */
export const SOFIA_CENTER = { lat: 42.6977, lng: 23.3219 };

/**
 * Sofia bounding box in bbox format (south,west,north,east)
 */
export const SOFIA_BBOX = `${SOFIA_BOUNDS.south},${SOFIA_BOUNDS.west},${SOFIA_BOUNDS.north},${SOFIA_BOUNDS.east}`;

/**
 * Check if coordinates are within Sofia's administrative boundaries
 */
export function isWithinSofia(lat: number, lng: number): boolean {
  return (
    lat >= SOFIA_BOUNDS.south &&
    lat <= SOFIA_BOUNDS.north &&
    lng >= SOFIA_BOUNDS.west &&
    lng <= SOFIA_BOUNDS.east
  );
}

/**
 * Check if coordinates match Sofia's exact center (rounded to 4 decimal places)
 * This detects Google's fallback to city center when it can't find a specific location
 */
export function isSofiaCenterFallback(lat: number, lng: number): boolean {
  // Round to 4 decimal places (approximately 11 meters precision)
  const roundedLat = Math.round(lat * 10000) / 10000;
  const roundedLng = Math.round(lng * 10000) / 10000;

  return roundedLat === SOFIA_CENTER.lat && roundedLng === SOFIA_CENTER.lng;
}

/**
 * Check if a formatted address is too generic (city-level only)
 */
export function isGenericCityAddress(formattedAddress: string): boolean {
  const genericPatterns = [
    /^Sofia,\s*Bulgaria$/i,
    /^София,\s*България$/i,
    /^Sofia$/i,
    /^София$/i,
  ];
  return genericPatterns.some((pattern) => pattern.test(formattedAddress));
}
