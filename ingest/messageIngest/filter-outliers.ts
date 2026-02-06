import { Address } from "@/lib/types";
import { logger } from "@/lib/logger";

/**
 * Calculate the Haversine distance between two coordinates in meters
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Find the minimum distance from a coordinate to any other coordinate in the set
 */
function findMinDistanceToOthers(
  targetIndex: number,
  addresses: Address[]
): number {
  const target = addresses[targetIndex];
  let minDistance = Infinity;

  for (let i = 0; i < addresses.length; i++) {
    if (i === targetIndex) continue;

    const distance = calculateDistance(
      target.coordinates.lat,
      target.coordinates.lng,
      addresses[i].coordinates.lat,
      addresses[i].coordinates.lng
    );

    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  return minDistance;
}

/**
 * Filter out outlier coordinates that are more than maxDistance meters
 * away from all other coordinates
 *
 * Step 4.5: Filter outlier coordinates
 */
export function filterOutlierCoordinates(
  addresses: Address[],
  maxDistance: number = 1000 // 1km default
): Address[] {
  // Need at least 2 addresses to detect outliers
  if (addresses.length < 2) {
    return addresses;
  }

  const filtered: Address[] = [];
  const outliers: Array<{ address: Address; distance: number }> = [];

  for (let i = 0; i < addresses.length; i++) {
    const minDistance = findMinDistanceToOthers(i, addresses);

    if (minDistance > maxDistance) {
      // This is an outlier
      outliers.push({ address: addresses[i], distance: minDistance });
    } else {
      filtered.push(addresses[i]);
    }
  }

  // Log outliers if any were found
  if (outliers.length > 0) {
    logger.warn("Filtered outlier coordinates", {
      count: outliers.length,
      outliers: outliers.map(({ address, distance }) => ({
        text: address.originalText,
        lat: address.coordinates.lat.toFixed(6),
        lng: address.coordinates.lng.toFixed(6),
        distanceKm: (distance / 1000).toFixed(2),
      })),
    });
  }

  return filtered;
}
