/**
 * Shared utilities for geocoding services
 */

import { getBoundsForTarget, getCenterForTarget, getBboxForTarget } from "./bounds";
import { getTargetLocality } from "./target-locality";

/**
 * Get the current target locality's bounds
 */
export function getTargetBounds() {
  return getBoundsForTarget(getTargetLocality());
}

/**
 * Get the current target locality's center
 */
export function getTargetCenter() {
  return getCenterForTarget(getTargetLocality());
}

/**
 * Get the current target locality's bbox
 */
export function getTargetBbox() {
  return getBboxForTarget(getTargetLocality());
}

/**
 * Check if coordinates match the target city's exact center (rounded to 4 decimal places)
 * This detects Google's fallback to city center when it can't find a specific location
 */
export function isCenterFallback(lat: number, lng: number): boolean {
  const center = getTargetCenter();
  // Round to 4 decimal places (approximately 11 meters precision)
  const roundedLat = Math.round(lat * 10000) / 10000;
  const roundedLng = Math.round(lng * 10000) / 10000;

  return roundedLat === center.lat && roundedLng === center.lng;
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
    /^Plovdiv,\s*Bulgaria$/i,
    /^Пловдив,\s*България$/i,
    /^Plovdiv$/i,
    /^Пловдив$/i,
  ];
  return genericPatterns.some((pattern) => pattern.test(formattedAddress));
}
