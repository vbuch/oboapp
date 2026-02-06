import {
  geocodeAddresses,
  geocodeIntersectionsForStreets,
  geocodeCadastralPropertiesFromIdentifiers,
  geocodeBusStops,
} from "@/lib/geocoding-router";
import {
  Address,
  ExtractedData,
  StreetSection,
  Coordinates,
} from "@/lib/types";
import type { CadastralGeometry } from "@/lib/cadastre-geocoding-service";
import type { CategorizedMessage } from "@/lib/categorize.schema";
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
    const normalizedText = addr.originalText.toLowerCase().trim();

    // Check if we've seen this exact text
    if (seen.has(normalizedText)) {
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
      seen.set(normalizedText, addr);
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
 * Step 4: Geocode addresses from extracted data using hybrid approach
 * Google for pins, Overpass for street intersections, Cadastre for УПИ, GTFS for bus stops
 */
export async function geocodeAddressesFromExtractedData(
  extractedData: ExtractedData | null,
  categorize?: CategorizedMessage | null,
): Promise<GeocodingResult> {
  const preGeocodedMap = new Map<string, Coordinates>();
  const addresses: Address[] = [];
  let cadastralGeometries: Map<string, CadastralGeometry> | undefined;

  if (!extractedData) {
    return { preGeocodedMap, addresses };
  }

  // Geocode pins using Google
  if (extractedData.pins.length > 0) {
    const pinAddresses = extractedData.pins.map((pin) => pin.address);
    const geocodedPins = await geocodeAddresses(pinAddresses);
    addresses.push(...geocodedPins);

    geocodedPins.forEach((addr) => {
      preGeocodedMap.set(addr.originalText, addr.coordinates);
    });
  }

  // Geocode street intersections using Overpass
  if (extractedData.streets.length > 0) {
    const streetGeocodedMap = await geocodeIntersectionsForStreets(
      extractedData.streets,
    );

    // Merge into preGeocodedMap and create Address objects for the addresses array
    streetGeocodedMap.forEach((coords, key) => {
      preGeocodedMap.set(key, coords);

      // Add to addresses array for UI display
      addresses.push({
        originalText: key,
        formattedAddress: key,
        coordinates: coords,
        geoJson: {
          type: "Point",
          coordinates: [coords.lng, coords.lat],
        },
      });
    });

    // Check for missing endpoints and try fallback geocoding
    const missingEndpoints = findMissingStreetEndpoints(
      extractedData.streets,
      preGeocodedMap,
    );

    if (missingEndpoints.length > 0) {
      const fallbackGeocoded = await geocodeAddresses(missingEndpoints);

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

  // Geocode bus stops using GTFS
  if (categorize?.busStops && categorize.busStops.length > 0) {
    const geocodedBusStops = await geocodeBusStops(categorize.busStops);
    addresses.push(...geocodedBusStops);

    geocodedBusStops.forEach((addr) => {
      preGeocodedMap.set(addr.originalText, addr.coordinates);
    });

    logger.info("Geocoded bus stops", {
      geocoded: geocodedBusStops.length,
      total: categorize.busStops.length,
    });
  }

  // Deduplicate addresses before returning
  const deduplicatedAddresses = deduplicateAddresses(addresses);

  return { preGeocodedMap, addresses: deduplicatedAddresses, cadastralGeometries };
}
