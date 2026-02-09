import {
  geocodeAddresses,
  geocodeIntersectionsForStreets,
  geocodeCadastralPropertiesFromIdentifiers,
  geocodeBusStops,
} from "@/lib/geocoding-router";
import { overpassGeocodeAddresses } from "@/lib/overpass-geocoding-service";
import {
  Address,
  ExtractedLocations,
  StreetSection,
  Coordinates,
} from "@/lib/types";
import type { CadastralGeometry } from "@/lib/cadastre-geocoding-service";
import { logger } from "@/lib/logger";

// Internal types for the geocoding pipeline
export interface GeocodingResult {
  preGeocodedMap: Map<string, Coordinates>;
  addresses: Address[];
  cadastralGeometries?: Map<string, CadastralGeometry>;
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
 * Geocode addresses from extracted locations using hybrid approach.
 * Google for pins, Overpass for street intersections, Cadastre for УПИ, GTFS for bus stops.
 * Skips geocoding for locations with pre-resolved coordinates from the AI.
 */
export async function geocodeAddressesFromExtractedData(
  extractedData: ExtractedLocations | null,
): Promise<GeocodingResult> {
  const preGeocodedMap = new Map<string, Coordinates>();
  const addresses: Address[] = [];
  let cadastralGeometries: Map<string, CadastralGeometry> | undefined;

  if (!extractedData) {
    return { preGeocodedMap, addresses };
  }

  // Geocode pins using Google (skip pins with pre-resolved coordinates)
  if (extractedData.pins.length > 0) {
    const pinsToGeocode: string[] = [];

    for (const pin of extractedData.pins) {
      if (pin.coordinates) {
        // Pre-resolved coordinates from AI — skip Google geocoding
        preGeocodedMap.set(pin.address, pin.coordinates);
        addresses.push({
          originalText: pin.address,
          formattedAddress: pin.address,
          coordinates: pin.coordinates,
          geoJson: {
            type: "Point",
            coordinates: [pin.coordinates.lng, pin.coordinates.lat],
          },
        });
      } else {
        pinsToGeocode.push(pin.address);
      }
    }

    if (pinsToGeocode.length > 0) {
      const geocodedPins = await geocodeAddresses(pinsToGeocode);
      addresses.push(...geocodedPins);

      geocodedPins.forEach((addr) => {
        preGeocodedMap.set(addr.originalText, addr.coordinates);
      });
    }
  }

  // Geocode street intersections using Overpass (skip endpoints with pre-resolved coordinates)
  if (extractedData.streets.length > 0) {
    // First, add any pre-resolved endpoint coordinates
    for (const street of extractedData.streets) {
      if (street.fromCoordinates) {
        preGeocodedMap.set(street.from, street.fromCoordinates);
        addresses.push({
          originalText: street.from,
          formattedAddress: street.from,
          coordinates: street.fromCoordinates,
          geoJson: {
            type: "Point",
            coordinates: [
              street.fromCoordinates.lng,
              street.fromCoordinates.lat,
            ],
          },
        });
      }
      if (street.toCoordinates) {
        preGeocodedMap.set(street.to, street.toCoordinates);
        addresses.push({
          originalText: street.to,
          formattedAddress: street.to,
          coordinates: street.toCoordinates,
          geoJson: {
            type: "Point",
            coordinates: [street.toCoordinates.lng, street.toCoordinates.lat],
          },
        });
      }
    }

    // Filter to streets that still need Overpass geocoding (at least one endpoint missing)
    const streetsNeedingGeocoding = extractedData.streets.filter(
      (street) =>
        !preGeocodedMap.has(street.from) || !preGeocodedMap.has(street.to),
    );

    if (streetsNeedingGeocoding.length > 0) {
      const streetGeocodedMap = await geocodeIntersectionsForStreets(
        streetsNeedingGeocoding,
        preGeocodedMap, // Pass the map to skip already geocoded endpoints
      );

      // Merge into preGeocodedMap and create Address objects
      streetGeocodedMap.forEach((coords, key) => {
        if (!preGeocodedMap.has(key)) {
          preGeocodedMap.set(key, coords);
          addresses.push({
            originalText: key,
            formattedAddress: key,
            coordinates: coords,
            geoJson: {
              type: "Point",
              coordinates: [coords.lng, coords.lat],
            },
          });
        }
      });
    }

    // Check for missing endpoints and try fallback geocoding
    const missingEndpoints = findMissingStreetEndpoints(
      extractedData.streets,
      preGeocodedMap,
    );

    if (missingEndpoints.length > 0) {
      // Use Overpass/Nominatim for street endpoints (handles house numbers via Nominatim)
      const fallbackGeocoded = await overpassGeocodeAddresses(missingEndpoints);

      fallbackGeocoded.forEach((addr) => {
        preGeocodedMap.set(addr.originalText, addr.coordinates);
        addresses.push(addr);
      });
    }
  }

  // Geocode cadastral properties using Bulgarian Cadastre API
  if (
    extractedData.cadastralProperties &&
    extractedData.cadastralProperties.length > 0
  ) {
    const identifiers = extractedData.cadastralProperties.map(
      (prop) => prop.identifier,
    );
    cadastralGeometries =
      await geocodeCadastralPropertiesFromIdentifiers(identifiers);

    logger.info("Geocoded cadastral properties", {
      geocoded: cadastralGeometries.size,
      total: identifiers.length,
    });
  }

  // Geocode bus stops using GTFS (from ExtractedLocations directly)
  if (extractedData.busStops && extractedData.busStops.length > 0) {
    const geocodedBusStops = await geocodeBusStops(extractedData.busStops);
    addresses.push(...geocodedBusStops);

    geocodedBusStops.forEach((addr) => {
      preGeocodedMap.set(addr.originalText, addr.coordinates);
    });

    logger.info("Geocoded bus stops", {
      geocoded: geocodedBusStops.length,
      total: extractedData.busStops.length,
    });
  }

  // Deduplicate addresses before returning
  const deduplicatedAddresses = deduplicateAddresses(addresses);

  return {
    preGeocodedMap,
    addresses: deduplicatedAddresses,
    cadastralGeometries,
  };
}
