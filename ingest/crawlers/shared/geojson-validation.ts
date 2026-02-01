import type {
  GeoJSONFeatureCollection,
  GeoJSONFeature,
  GeoJSONGeometry,
  GeoJSONPoint,
  GeoJSONLineString,
  GeoJSONPolygon,
} from "@/lib/types";
import { SOFIA_BOUNDS } from "@/lib/bounds";

/**
 * Check if coordinates are within Sofia bounds
 */
export function isWithinSofia(lat: number, lng: number): boolean {
  return (
    lat >= SOFIA_BOUNDS.south &&
    lat <= SOFIA_BOUNDS.north &&
    lng >= SOFIA_BOUNDS.west &&
    lng <= SOFIA_BOUNDS.east
  );
}

export interface ValidationResult {
  isValid: boolean;
  geoJson: GeoJSONFeatureCollection | null;
  warnings: string[];
  errors: string[];
  fixedCoordinates: boolean;
}

/**
 * Check if coordinates are valid (within global bounds)
 */
export function isValidCoordinate(lng: number, lat: number): boolean {
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

/**
 * Detect if coordinates are swapped [lat,lng] instead of [lng,lat]
 * Returns true if they appear to be swapped
 */
export function detectSwappedCoordinates(lng: number, lat: number): boolean {
  // If the "longitude" is in latitude range and "latitude" is in longitude range
  // and they would be valid if swapped
  const seemsSwapped =
    lng >= -90 &&
    lng <= 90 &&
    lat >= -180 &&
    lat <= 180 &&
    !isWithinSofia(lat, lng) &&
    isWithinSofia(lng, lat);

  return seemsSwapped;
}

/**
 * Fix swapped coordinates by swapping them
 */
export function fixSwappedCoordinates(
  coords: [number, number],
): [number, number] {
  return [coords[1], coords[0]];
}

/**
 * Validate and potentially fix a Point geometry
 */
function validateAndFixPoint(
  geometry: unknown,
  warnings: string[],
): GeoJSONPoint | null {
  if (
    !geometry ||
    typeof geometry !== "object" ||
    !("coordinates" in geometry)
  ) {
    return null;
  }

  const coords = geometry.coordinates;

  if (!Array.isArray(coords) || coords.length !== 2) {
    return null;
  }

  if (typeof coords[0] !== "number" || typeof coords[1] !== "number") {
    return null;
  }

  let [lng, lat] = coords;

  // Check if coordinates are swapped
  if (detectSwappedCoordinates(lng, lat)) {
    warnings.push(
      `Point coordinates swapped from [${lng}, ${lat}] to [${lat}, ${lng}]`,
    );
    [lng, lat] = fixSwappedCoordinates([lng, lat]);
  }

  if (!isValidCoordinate(lng, lat)) {
    return null;
  }

  return {
    type: "Point",
    coordinates: [lng, lat],
  };
}

/**
 * Validate and potentially fix a LineString geometry
 */
function validateAndFixLineString(
  geometry: unknown,
  warnings: string[],
): GeoJSONLineString | null {
  if (
    !geometry ||
    typeof geometry !== "object" ||
    !("coordinates" in geometry)
  ) {
    return null;
  }

  const coords = geometry.coordinates;

  if (!Array.isArray(coords) || coords.length < 2) {
    return null;
  }

  const fixedCoords: [number, number][] = [];
  let hasSwaps = false;

  for (let i = 0; i < coords.length; i++) {
    const point = coords[i];
    if (!Array.isArray(point) || point.length !== 2) {
      return null;
    }

    if (typeof point[0] !== "number" || typeof point[1] !== "number") {
      return null;
    }

    let [lng, lat] = point;

    // Check if coordinates are swapped
    if (detectSwappedCoordinates(lng, lat)) {
      [lng, lat] = fixSwappedCoordinates([lng, lat]);
      hasSwaps = true;
    }

    if (!isValidCoordinate(lng, lat)) {
      return null;
    }

    fixedCoords.push([lng, lat]);
  }

  if (hasSwaps) {
    warnings.push(`LineString had ${fixedCoords.length} coordinates swapped`);
  }

  return {
    type: "LineString",
    coordinates: fixedCoords,
  };
}

/**
 * Validate and potentially fix a Polygon geometry
 */
function validateAndFixPolygon(
  geometry: unknown,
  warnings: string[],
): GeoJSONPolygon | null {
  if (
    !geometry ||
    typeof geometry !== "object" ||
    !("coordinates" in geometry)
  ) {
    return null;
  }

  const coords = geometry.coordinates;

  if (!Array.isArray(coords) || coords.length < 1) {
    return null;
  }

  const fixedRings: [number, number][][] = [];
  let hasSwaps = false;

  for (const ring of coords) {
    if (!Array.isArray(ring) || ring.length < 4) {
      return null;
    }

    const fixedRing: [number, number][] = [];

    for (let i = 0; i < ring.length; i++) {
      const point = ring[i];
      if (!Array.isArray(point) || point.length !== 2) {
        return null;
      }

      if (typeof point[0] !== "number" || typeof point[1] !== "number") {
        return null;
      }

      let [lng, lat] = point;

      // Check if coordinates are swapped
      if (detectSwappedCoordinates(lng, lat)) {
        [lng, lat] = fixSwappedCoordinates([lng, lat]);
        hasSwaps = true;
      }

      if (!isValidCoordinate(lng, lat)) {
        return null;
      }

      fixedRing.push([lng, lat]);
    }

    // Validate that ring is closed
    const first = fixedRing[0];
    const last = fixedRing[fixedRing.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      return null;
    }

    fixedRings.push(fixedRing);
  }

  if (hasSwaps) {
    warnings.push(`Polygon had coordinates swapped`);
  }

  return {
    type: "Polygon",
    coordinates: fixedRings,
  };
}

/**
 * Validate and potentially fix a geometry
 */
function validateAndFixGeometry(
  geometry: unknown,
  warnings: string[],
): GeoJSONGeometry | null {
  if (!geometry || typeof geometry !== "object" || !("type" in geometry)) {
    return null;
  }

  const geomType = (geometry as { type: unknown }).type;

  switch (geomType) {
    case "Point":
      return validateAndFixPoint(geometry, warnings);
    case "LineString":
      return validateAndFixLineString(geometry, warnings);
    case "Polygon":
      return validateAndFixPolygon(geometry, warnings);
    default:
      return null;
  }
}

/**
 * Validate and potentially fix a GeoJSON FeatureCollection
 * Auto-detects and fixes swapped [lat,lng] vs [lng,lat] coordinates
 */
export function validateAndFixGeoJSON(
  data: unknown,
  context?: string,
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const contextPrefix = context ? `[${context}] ` : "";

  // Validate basic structure
  if (!data || typeof data !== "object") {
    errors.push(`${contextPrefix}GeoJSON is not an object`);
    return {
      isValid: false,
      geoJson: null,
      warnings,
      errors,
      fixedCoordinates: false,
    };
  }

  if (!("type" in data) || data.type !== "FeatureCollection") {
    const dataType = "type" in data ? String(data.type) : "unknown";
    errors.push(
      `${contextPrefix}GeoJSON type must be "FeatureCollection", got "${dataType}"`,
    );
    return {
      isValid: false,
      geoJson: null,
      warnings,
      errors,
      fixedCoordinates: false,
    };
  }

  if (!("features" in data) || !Array.isArray(data.features)) {
    errors.push(`${contextPrefix}GeoJSON features must be an array`);
    return {
      isValid: false,
      geoJson: null,
      warnings,
      errors,
      fixedCoordinates: false,
    };
  }

  // Validate and fix each feature
  const fixedFeatures: GeoJSONFeature[] = [];
  const features = data.features as unknown[];

  for (let i = 0; i < features.length; i++) {
    const feature = features[i];

    if (!feature || typeof feature !== "object") {
      errors.push(`${contextPrefix}Feature ${i} is not an object`);
      continue;
    }

    if (!("type" in feature) || feature.type !== "Feature") {
      const featureType = "type" in feature ? String(feature.type) : "unknown";
      errors.push(
        `${contextPrefix}Feature ${i} type must be "Feature", got "${featureType}"`,
      );
      continue;
    }

    if (!("geometry" in feature) || !feature.geometry) {
      errors.push(`${contextPrefix}Feature ${i} missing geometry`);
      continue;
    }

    const featureWarnings: string[] = [];
    const fixedGeometry = validateAndFixGeometry(
      feature.geometry,
      featureWarnings,
    );

    if (!fixedGeometry) {
      errors.push(`${contextPrefix}Feature ${i} has invalid geometry`);
      continue;
    }

    // Add warnings with feature index
    featureWarnings.forEach((w) => {
      warnings.push(`${contextPrefix}Feature ${i}: ${w}`);
    });

    const properties =
      "properties" in feature && typeof feature.properties === "object"
        ? (feature.properties as Record<string, unknown>)
        : {};

    fixedFeatures.push({
      type: "Feature",
      geometry: fixedGeometry,
      properties,
    });
  }

  if (fixedFeatures.length === 0 && data.features.length > 0) {
    errors.push(`${contextPrefix}All features are invalid`);
    return {
      isValid: false,
      geoJson: null,
      warnings,
      errors,
      fixedCoordinates: false,
    };
  }

  const geoJson: GeoJSONFeatureCollection = {
    type: "FeatureCollection",
    features: fixedFeatures,
  };

  return {
    isValid: true,
    geoJson,
    warnings,
    errors,
    fixedCoordinates: warnings.length > 0,
  };
}
