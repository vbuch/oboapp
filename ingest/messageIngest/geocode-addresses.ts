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
import { isWithinSofia } from "@/lib/bounds";

// Internal types for the geocoding pipeline
export interface GeocodingResult {
  preGeocodedMap: Map<string, Coordinates>;
  addresses: Address[];
  cadastralGeometries?: Map<string, CadastralGeometry>;
}

/**
 * Validate and normalize pre-resolved coordinates from source
 * - Rounds to 5 decimal places (precision ~1.1 meters)
 * - Validates coordinates are within Sofia bounds
 * Returns null if coordinates are invalid
 * Exported for unit testing
 */
export function validatePreResolvedCoordinates(
  coordinates: Coordinates,
  context: string,
): Coordinates | null {
  // Round to 5 decimal places (precision ~1.1 meters at Sofia's latitude)
  const rounded: Coordinates = {
    lat: Math.round(coordinates.lat * 100000) / 100000,
    lng: Math.round(coordinates.lng * 100000) / 100000,
  };

  // Validate coordinates are within Sofia bounds
  if (!isWithinSofia(rounded.lat, rounded.lng)) {
    logger.warn("Pre-resolved coordinates outside Sofia bounds", {
      context,
      original: coordinates,
      rounded,
    });
    return null;
  }

  // Log if coordinates were rounded significantly (more than 0.00001 degrees ~1 meter)
  const latDiff = Math.abs(coordinates.lat - rounded.lat);
  const lngDiff = Math.abs(coordinates.lng - rounded.lng);
  if (latDiff > 0.00001 || lngDiff > 0.00001) {
    logger.info("Rounded pre-resolved coordinates", {
      context,
      original: coordinates,
      rounded,
      latDiff,
      lngDiff,
    });
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
        // Validate and normalize pre-resolved coordinates from AI
        const validatedCoords = validatePreResolvedCoordinates(
          pin.coordinates,
          `pin: ${pin.address}`,
        );

        if (validatedCoords) {
          // Pre-resolved coordinates are valid — skip Google geocoding
          preGeocodedMap.set(pin.address, validatedCoords);
          addresses.push({
            originalText: pin.address,
            formattedAddress: pin.address,
            coordinates: validatedCoords,
            geoJson: {
              type: "Point",
              coordinates: [validatedCoords.lng, validatedCoords.lat],
            },
          });
        } else {
          // Invalid coordinates — fallback to geocoding
          logger.warn("Invalid pre-resolved coordinates for pin, will geocode", {
            address: pin.address,
            coordinates: pin.coordinates,
          });
          pinsToGeocode.push(pin.address);
        }
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
        const validatedCoords = validatePreResolvedCoordinates(
          street.fromCoordinates,
          `street endpoint: ${street.street} from ${street.from}`,
        );

        if (validatedCoords) {
          preGeocodedMap.set(street.from, validatedCoords);
          addresses.push({
            originalText: street.from,
            formattedAddress: street.from,
            coordinates: validatedCoords,
            geoJson: {
              type: "Point",
              coordinates: [validatedCoords.lng, validatedCoords.lat],
            },
          });
        } else {
          logger.warn(
            "Invalid pre-resolved coordinates for street endpoint, will geocode",
            {
              street: street.street,
              endpoint: street.from,
              coordinates: street.fromCoordinates,
            },
          );
        }
      }
      if (street.toCoordinates) {
        const validatedCoords = validatePreResolvedCoordinates(
          street.toCoordinates,
          `street endpoint: ${street.street} to ${street.to}`,
        );

        if (validatedCoords) {
          preGeocodedMap.set(street.to, validatedCoords);
          addresses.push({
            originalText: street.to,
            formattedAddress: street.to,
            coordinates: validatedCoords,
            geoJson: {
              type: "Point",
              coordinates: [validatedCoords.lng, validatedCoords.lat],
            },
          });
        } else {
          logger.warn(
            "Invalid pre-resolved coordinates for street endpoint, will geocode",
            {
              street: street.street,
              endpoint: street.to,
              coordinates: street.toCoordinates,
            },
          );
        }
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
