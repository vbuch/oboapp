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

// Internal types for the geocoding pipeline
export interface GeocodingResult {
  preGeocodedMap: Map<string, Coordinates>;
  addresses: Address[];
  cadastralGeometries?: Map<string, CadastralGeometry>;
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

    console.log(
      `[Geocoding] Geocoded ${cadastralGeometries.size}/${identifiers.length} cadastral properties`,
    );
  }

  // Geocode bus stops using GTFS
  if (categorize?.busStops && categorize.busStops.length > 0) {
    const geocodedBusStops = await geocodeBusStops(categorize.busStops);
    addresses.push(...geocodedBusStops);

    geocodedBusStops.forEach((addr) => {
      preGeocodedMap.set(addr.originalText, addr.coordinates);
    });

    console.log(
      `[Geocoding] Geocoded ${geocodedBusStops.length}/${categorize.busStops.length} bus stops`,
    );
  }

  return { preGeocodedMap, addresses, cadastralGeometries };
}
