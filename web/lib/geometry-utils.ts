import center from "@turf/center";
import { lineString, polygon } from "@turf/helpers";
import type { GeoJSONGeometry } from "@/lib/types";

/**
 * Convert GeoJSON coordinate to Google Maps LatLng format
 * GeoJSON uses [longitude, latitude] order, Google Maps uses {lat, lng}
 *
 * @param coord - GeoJSON coordinate array [longitude, latitude]
 * @returns Google Maps LatLng object
 */
export const toLatLng = (coord: number[]): { lat: number; lng: number } => {
  if (!coord || coord.length < 2) {
    throw new Error(
      "Invalid coordinate: must be an array with at least 2 elements",
    );
  }
  if (
    typeof coord[0] !== "number" ||
    typeof coord[1] !== "number" ||
    !Number.isFinite(coord[0]) ||
    !Number.isFinite(coord[1])
  ) {
    throw new Error(
      "Invalid coordinate: longitude and latitude must be numbers",
    );
  }

  return {
    lat: coord[1], // latitude
    lng: coord[0], // longitude
  };
};

/**
 * Calculate centroid for any geometry type (Point, LineString, Polygon)
 *
 * @param geometry - GeoJSON geometry object
 * @returns Centroid as Google Maps LatLng object, or null if calculation fails
 */
export const getCentroid = (
  geometry: GeoJSONGeometry,
): { lat: number; lng: number } | null => {
  if (!geometry || !geometry.type) {
    return null;
  }

  try {
    switch (geometry.type) {
      case "Point": {
        if (!geometry.coordinates || !Array.isArray(geometry.coordinates)) {
          return null;
        }
        return toLatLng(geometry.coordinates);
      }
      case "LineString": {
        if (
          !geometry.coordinates ||
          !Array.isArray(geometry.coordinates) ||
          geometry.coordinates.length === 0
        ) {
          return null;
        }
        const turfLine = lineString(geometry.coordinates);
        const turfCenter = center(turfLine);
        return toLatLng(turfCenter.geometry.coordinates);
      }
      case "Polygon": {
        if (
          !geometry.coordinates ||
          !Array.isArray(geometry.coordinates) ||
          geometry.coordinates.length === 0
        ) {
          return null;
        }
        const turfPolygon = polygon(geometry.coordinates);
        const turfCenter = center(turfPolygon);
        return toLatLng(turfCenter.geometry.coordinates);
      }
      default:
        return null;
    }
  } catch (error) {
    console.error("Error calculating centroid:", error);
    return null;
  }
};

/**
 * Generate unique feature key for identifying specific features within messages
 *
 * @param messageId - The message ID
 * @param featureIndex - The index of the feature within the message's GeoJSON
 * @returns Unique feature key string
 */
export const createFeatureKey = (
  messageId: string,
  featureIndex: number,
): string => {
  if (!messageId || typeof messageId !== "string") {
    throw new Error("Invalid messageId: must be a non-empty string");
  }
  if (
    typeof featureIndex !== "number" ||
    featureIndex < 0 ||
    !Number.isInteger(featureIndex)
  ) {
    throw new Error("Invalid featureIndex: must be a non-negative integer");
  }

  return `${messageId}-${featureIndex}`;
};

/**
 * Apply jittering to duplicate positions to prevent overlapping markers.
 * Positions are considered duplicates if they have identical lat/lng coordinates.
 * Each duplicate gets a small random offset (~5-10 meters) in a random direction.
 *
 * @param positions - Array of position objects with lat and lng properties
 * @returns Array of positions with jittering applied to duplicates
 */
export const jitterDuplicatePositions = <
  T extends { lat: number; lng: number },
>(
  positions: T[],
): T[] => {
  if (!Array.isArray(positions)) {
    throw new Error("Invalid input: positions must be an array");
  }

  // Group positions by their coordinates
  const positionGroups = new Map<string, T[]>();

  positions.forEach((pos) => {
    if (
      typeof pos.lat !== "number" ||
      typeof pos.lng !== "number" ||
      !Number.isFinite(pos.lat) ||
      !Number.isFinite(pos.lng)
    ) {
      throw new Error("Invalid position: lat and lng must be finite numbers");
    }

    const key = `${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}`;
    if (!positionGroups.has(key)) {
      positionGroups.set(key, []);
    }
    positionGroups.get(key)!.push(pos);
  });

  // Apply jittering to groups with duplicates
  const result: T[] = [];

  positionGroups.forEach((group) => {
    if (group.length === 1) {
      // No duplicates, keep original position
      result.push(group[0]);
    } else {
      // Duplicates found, apply jittering to each
      group.forEach((pos) => {
        // Random angle between 0 and 2π
        const angle = Math.random() * 2 * Math.PI;

        // Random distance between 5 and 10 meters
        // Approximate conversion from meters to degrees at mid-latitudes
        // Note: This is a simplification that assumes Earth is spherical.
        // More precise conversion would account for latitude-specific scaling.
        const METERS_TO_DEGREES_APPROX = 1 / 111000;
        const distanceMeters = 5 + Math.random() * 5;
        const distanceDegrees = distanceMeters * METERS_TO_DEGREES_APPROX;

        // Calculate offset in lat/lng
        const latOffset = distanceDegrees * Math.cos(angle);
        const lngOffset = distanceDegrees * Math.sin(angle);

        result.push({
          ...pos,
          lat: pos.lat + latOffset,
          lng: pos.lng + lngOffset,
        });
      });
    }
  });

  return result;
};
