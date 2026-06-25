import { geocode } from "@/geocoding/geocode";
import { getGeocodingProviders } from "@/geocoding/providers";
import { getLocality } from "@/lib/target-locality";
import {
  Address,
  ExtractedLocations,
  StreetSection,
  Coordinates,
  QualitySignals,
  isWithinBounds,
} from "@oboapp/shared";
import type { CadastralGeometry } from "@/geocoding/cadastre/service";
import type { IngestErrorRecorder } from "@/lib/ingest-errors";
import type { IntersectionCoordinates } from "@/lib/types";
import { logger } from "@/lib/logger";
import { roundCoordinate } from "@/geocoding/shared/coordinate-utils";
import type { GeocodingProgressTracker } from "./geocoding-progress-tracker";
import type { GeocodingContext } from "@/geocoding/interfaces";

// Internal types for the geocoding pipeline
export interface GeocodingResult {
  preGeocodedMap: Map<string, Coordinates>;
  qualityMap: Map<string, QualitySignals>;
  addresses: Address[];
  cadastralGeometries?: Map<string, CadastralGeometry>;
}

/**
 * Validate and normalize geotagged coordinates from source.
 * Some sources practice geotagging, embedding coordinates directly in messages.
 * - Rounds to 6 decimal places (precision ~0.1 meters)
 * - Validates coordinates are within target locality bounds
 * Returns null if coordinates are invalid
 * Exported for unit testing
 */
export function getValidPreResolvedCoordinates(
  coordinates: Coordinates,
  context: string,
): Coordinates | null {
  // Round to 6 decimal places (precision ~0.1 meters at Sofia's latitude)
  const rounded: Coordinates = {
    lat: roundCoordinate(coordinates.lat),
    lng: roundCoordinate(coordinates.lng),
  };

  // Validate coordinates are within target locality bounds
  const locality = getLocality();
  if (!isWithinBounds(locality, rounded.lat, rounded.lng)) {
    logger.warn("Geotagged coordinates outside locality bounds", {
      context,
      locality,
      original: coordinates,
      rounded,
    });
    return null;
  }

  return rounded;
}

/**
 * Helper: Deduplicate addresses by normalized text or close coordinates
 * Exported for unit testing
 */
export function deduplicateAddresses(addresses: Address[]): Address[] {
  const seen = new Map<string, Address>();
  const DISTANCE_THRESHOLD_METERS = 50;

  for (const addr of addresses) {
    const plainText = addr.originalText.toLowerCase().trim();

    // Check if we've seen this exact text
    if (seen.has(plainText)) {
      continue;
    }

    // Check if any existing address is within distance threshold
    let isDuplicate = false;
    for (const existing of seen.values()) {
      const dist = haversineDistance(
        addr.coordinates.lat,
        addr.coordinates.lng,
        existing.coordinates.lat,
        existing.coordinates.lng,
      );
      if (dist < DISTANCE_THRESHOLD_METERS) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      seen.set(plainText, addr);
    }
  }

  return Array.from(seen.values());
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Helper: Find missing street endpoints that haven't been geocoded
 * Exported for unit testing
 */
export function findMissingStreetEndpoints(
  streets: StreetSection[],
  geocodedMap: Map<string, Coordinates>,
): string[] {
  const missing: string[] = [];

  streets.forEach((street) => {
    if (!geocodedMap.has(street.from)) {
      missing.push(street.from);
    }
    if (!geocodedMap.has(street.to)) {
      missing.push(street.to);
    }
  });

  return missing;
}

/**
 * Helper: Create an Address object from validated coordinates
 * Exported for unit testing
 */
export function createAddressFromCoordinates(
  text: string,
  coordinates: Coordinates,
  qualitySignals?: QualitySignals,
): Address {
  return {
    originalText: text,
    formattedAddress: text,
    coordinates,
    geoJson: {
      type: "Point",
      coordinates: [coordinates.lng, coordinates.lat],
    },
    ...(qualitySignals && { qualitySignals }),
  };
}

/**
 * Add a single geotagged coordinate to results if valid and not already present
 */
function addGeotaggedCoordinate(
  key: string,
  coordinates: IntersectionCoordinates | undefined,
  context: string,
  result: GeocodingResult,
): void {
  if (!coordinates) return;
  if (result.preGeocodedMap.has(key)) return;

  const validatedCoords = getValidPreResolvedCoordinates(coordinates, context);
  if (!validatedCoords) return;

  result.preGeocodedMap.set(key, validatedCoords);
  result.qualityMap.set(key, {
    provider: "source",
    geometryQuality: 1,
  });
  result.addresses.push(
    createAddressFromCoordinates(key, validatedCoords, {
      provider: "source",
      geometryQuality: 1,
    }),
  );
}

/**
 * Add geotagged pin coordinates to results
 */
function addGeotaggedPins(
  extractedData: ExtractedLocations,
  result: GeocodingResult,
): void {
  if (!extractedData.pins || extractedData.pins.length === 0) return;

  for (const pin of extractedData.pins) {
    addGeotaggedCoordinate(
      pin.address,
      pin.coordinates,
      `pin: ${pin.address}`,
      result,
    );
  }
}

/**
 * Add geotagged street endpoint coordinates to results
 */
function addGeotaggedStreetEndpoints(
  extractedData: ExtractedLocations,
  result: GeocodingResult,
): void {
  if (!extractedData.streets || extractedData.streets.length === 0) return;

  for (const street of extractedData.streets) {
    addGeotaggedCoordinate(
      street.from,
      street.fromCoordinates,
      `street endpoint: ${street.street} from ${street.from}`,
      result,
    );
    addGeotaggedCoordinate(
      street.to,
      street.toCoordinates,
      `street endpoint: ${street.street} to ${street.to}`,
      result,
    );
  }
}

/**
 * Geocode addresses from extracted locations.
 *
 * Phase 4 Refactoring:
 * Replaced specialized per-type geocoding functions with a unified geocode() entry point
 * that processes all entity types (pins, streets, cadastral, bus stops, educational facilities)
 * through provider chains configured in shared/src/geocoding-sources.ts.
 *
 * Process:
 * 1. Build a GeocodingContext from extracted locations
 * 2. Call geocode(context, providers) to coordinate all provider chains
 * 3. Deduplicate addresses before returning
 *
 * DEFERRED (Phase 5): Re-integrate detailed progress tracking (tracker parameter) and
 * ingest error handling for each entity type. Currently these parameters are accepted
 * for backward compatibility but not used. // NOSONAR
 */
export async function geocodeAddressesFromExtractedData(
  extractedData: ExtractedLocations | null,
  ingestErrors?: IngestErrorRecorder,
  tracker?: GeocodingProgressTracker,
): Promise<GeocodingResult> {
  if (!extractedData) {
    return {
      preGeocodedMap: new Map(),
      qualityMap: new Map(),
      addresses: [],
    };
  }

  // Build geocoding context from extracted data
  const locality = getLocality();
  const context: GeocodingContext = {
    extractedLocations: extractedData,
    locality,
  };

  // Get configured providers and geocode all entity types through provider chains
  const providers = getGeocodingProviders();
  const result = await geocode(context, providers);

  // Add geotagged coordinates to results if not already present
  addGeotaggedPins(extractedData, result);
  addGeotaggedStreetEndpoints(extractedData, result);

  // Deduplicate addresses before returning
  const deduplicatedAddresses = deduplicateAddresses(result.addresses);

  // DEFERRED (Phase 5): Re-integrate detailed progress tracking for all entity types
  // For now, tracker and ingestErrors parameters are accepted for backward compatibility but not used // NOSONAR
  if (tracker) {
    logger.debug(
      "Geocoding progress tracker provided but not yet integrated in Phase 4; see Phase 5 DEFERRED",
    );
  }
  if (ingestErrors) {
    logger.debug(
      "Ingest error recorder provided but not yet integrated in Phase 4; see Phase 5 TODO",
    );
  }

  return {
    ...result,
    addresses: deduplicatedAddresses,
  };
}
