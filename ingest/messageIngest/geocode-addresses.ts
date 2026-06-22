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
 * Some sources practice geotagging � embedding coordinates directly in messages.
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

    // Check if we''ve seen this exact text
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
  const R = 6371000; // Earth''s radius in meters
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
 * Helper: Find missing street endpoints that haven''t been geocoded
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
 * TODO (Phase 5): Re-integrate detailed progress tracking (tracker parameter) and
 * ingest error handling for each entity type. Currently these parameters are accepted
 * for backward compatibility but not used.
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

  // Add geotagged pin coordinates to results if not already present
  if (extractedData.pins && extractedData.pins.length > 0) {
    for (const pin of extractedData.pins) {
      if (pin.coordinates) {
        const validatedCoords = getValidPreResolvedCoordinates(
          pin.coordinates,
          `pin: ${pin.address}`,
        );
        if (validatedCoords && !result.preGeocodedMap.has(pin.address)) {
          result.preGeocodedMap.set(pin.address, validatedCoords);
          result.qualityMap.set(pin.address, {
            provider: "source",
            geometryQuality: 1,
          });
          result.addresses.push(
            createAddressFromCoordinates(pin.address, validatedCoords, {
              provider: "source",
              geometryQuality: 1,
            }),
          );
        }
      }
    }
  }

  // Add geotagged street endpoints to results if not already present
  if (extractedData.streets && extractedData.streets.length > 0) {
    for (const street of extractedData.streets) {
      // Process "from" endpoint
      if (street.fromCoordinates) {
        const validatedCoords = getValidPreResolvedCoordinates(
          street.fromCoordinates,
          `street endpoint: ${street.street} from ${street.from}`,
        );
        if (validatedCoords && !result.preGeocodedMap.has(street.from)) {
          result.preGeocodedMap.set(street.from, validatedCoords);
          result.qualityMap.set(street.from, {
            provider: "source",
            geometryQuality: 1,
          });
          result.addresses.push(
            createAddressFromCoordinates(street.from, validatedCoords, {
              provider: "source",
              geometryQuality: 1,
            }),
          );
        }
      }

      // Process "to" endpoint
      if (street.toCoordinates) {
        const validatedCoords = getValidPreResolvedCoordinates(
          street.toCoordinates,
          `street endpoint: ${street.street} to ${street.to}`,
        );
        if (validatedCoords && !result.preGeocodedMap.has(street.to)) {
          result.preGeocodedMap.set(street.to, validatedCoords);
          result.qualityMap.set(street.to, {
            provider: "source",
            geometryQuality: 1,
          });
          result.addresses.push(
            createAddressFromCoordinates(street.to, validatedCoords, {
              provider: "source",
              geometryQuality: 1,
            }),
          );
        }
      }
    }
  }

  // Deduplicate addresses before returning
  const deduplicatedAddresses = deduplicateAddresses(result.addresses);

  // TODO (Phase 5): Re-integrate detailed progress tracking for all entity types
  // For now, tracker and ingestErrors parameters are accepted for backward compatibility but not used
  if (tracker) {
    logger.debug(
      "Geocoding progress tracker provided but not yet integrated in Phase 4; see Phase 5 TODO",
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
