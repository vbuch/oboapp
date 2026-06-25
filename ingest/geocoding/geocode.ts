/**
 * Main geocoding orchestrator.
 * Coordinates provider chains for all entity types (pins, streets, cadastral, bus stops, facilities).
 *
 * Architecture:
 * - For each entity type, iterate through provider array in order
 * - Call provider.geocodePin/Street/Cadastral/BusStop/EducationalFacility(location)
 * - Stop at first non-null result
 * - Call provider.done(resultsMap) on all providers after each entity type completes
 * - Pre-geocoded coordinates (geotagged sources) bypass the provider chain
 */

import { StreetSection, CadastralProperty } from "@/lib/types";
import { QualitySignals, EducationalFacilityRef } from "@oboapp/shared";
import type { Address, Coordinates } from "@oboapp/shared";
import { EDUCATIONAL_FACILITY_PREFIX } from "@/lib/constants";
import type {
  GeocodingContext,
  GeocodingProviders,
  GeocodingResult,
  PinResult,
  StreetResult,
  CadastralResult,
  BusStopResult,
  EducationalFacilityResult,
} from "./interfaces";
import type { CadastralGeometry } from "@/geocoding/cadastre/service";

/**
 * Main geocoding entry point.
 * Processes all extracted locations through the provider chains.
 */
export async function geocode(
  context: GeocodingContext,
  providers: GeocodingProviders,
): Promise<GeocodingResult> {
  const { preGeocodedMap, qualityMap, addresses, cadastralGeometries } =
    await processAllEntityTypes(context, providers);

  return {
    preGeocodedMap,
    qualityMap,
    addresses,
    cadastralGeometries,
  };
}

/**
 * Process and store pin results
 */
function processPinResults(
  results: Array<{ pinAddress: string; result: PinResult }>,
  preGeocodedMap: Map<string, Coordinates>,
  qualityMap: Map<string, QualitySignals>,
  addresses: Address[],
): void {
  for (const { pinAddress, result } of results) {
    preGeocodedMap.set(pinAddress, result.address.coordinates);
    addresses.push(result.address);
    qualityMap.set(
      pinAddress,
      result.address.qualitySignals || {
        provider: "google",
        geometryQuality: 0,
      },
    );
  }
}

/**
 * Process and store street results
 */
function processStreetResults(
  results: Array<{ location: StreetSection; result: StreetResult }>,
  preGeocodedMap: Map<string, Coordinates>,
  qualityMap: Map<string, QualitySignals>,
): void {
  for (const { location, result } of results) {
    if (result.fromCoordinates) {
      preGeocodedMap.set(location.from, result.fromCoordinates);
      qualityMap.set(location.from, result.qualitySignals);
    }

    if (result.toCoordinates) {
      preGeocodedMap.set(location.to, result.toCoordinates);
      qualityMap.set(location.to, result.qualitySignals);
    }
  }
}

/**
 * Process and store cadastral results
 */
function processCadastralResults(
  results: Array<{ identifier: string; geometry: CadastralGeometry }>,
  cadastralGeometries: Map<string, CadastralGeometry>,
): void {
  for (const result of results) {
    cadastralGeometries.set(result.identifier, result.geometry);
  }
}

/**
 * Process and store bus stop results
 */
function processBusStopResults(
  results: Array<{
    stopCode: string;
    coordinates: Coordinates;
    qualitySignals: QualitySignals;
  }>,
  qualityMap: Map<string, QualitySignals>,
  addresses: Address[],
): void {
  for (const result of results) {
    const address = coordinatesToAddress(
      `Спирка ${result.stopCode}`,
      result.coordinates,
      result.qualitySignals,
    );
    addresses.push(address);
    qualityMap.set(`bus_stop_${result.stopCode}`, result.qualitySignals);
  }
}

/**
 * Process and store educational facility results
 */
function processEducationalFacilityResults(
  results: Array<{
    number: string;
    type: string;
    coordinates: Coordinates;
    qualitySignals: QualitySignals;
  }>,
  qualityMap: Map<string, QualitySignals>,
  addresses: Address[],
): void {
  for (const result of results) {
    const address = coordinatesToAddress(
      `${EDUCATIONAL_FACILITY_PREFIX}${result.type}:${result.number}`,
      result.coordinates,
      result.qualitySignals,
    );
    addresses.push(address);
    qualityMap.set(
      `facility_${result.type}_${result.number}`,
      result.qualitySignals,
    );
  }
}

/**
 * Process all entity types in sequence
 */
async function processAllEntityTypes(
  context: GeocodingContext,
  providers: GeocodingProviders,
): Promise<GeocodingResult> {
  const preGeocodedMap = new Map<string, Coordinates>();
  const qualityMap = new Map<string, QualitySignals>();
  const addresses: Address[] = [];
  const cadastralGeometries = new Map<string, CadastralGeometry>();

  const { extractedLocations } = context;

  // Process pins
  if (extractedLocations.pins && extractedLocations.pins.length > 0) {
    const pinResults = await geocodePins(
      extractedLocations.pins,
      context,
      providers,
    );
    processPinResults(pinResults, preGeocodedMap, qualityMap, addresses);
  }

  // Process streets
  if (extractedLocations.streets && extractedLocations.streets.length > 0) {
    const streetResults = await geocodeStreets(
      extractedLocations.streets,
      context,
      providers,
    );
    processStreetResults(streetResults, preGeocodedMap, qualityMap);
  }

  // Process cadastral properties
  if (
    extractedLocations.cadastralProperties &&
    extractedLocations.cadastralProperties.length > 0
  ) {
    const cadastralResults = await geocodeCadastral(
      extractedLocations.cadastralProperties,
      context,
      providers,
    );
    processCadastralResults(cadastralResults, cadastralGeometries);
  }

  // Process bus stops
  if (extractedLocations.busStops && extractedLocations.busStops.length > 0) {
    const busStopResults = await geocodeBusStops(
      extractedLocations.busStops,
      context,
      providers,
    );
    processBusStopResults(busStopResults, qualityMap, addresses);
  }

  // Process educational facilities
  if (
    extractedLocations.educationalFacilities &&
    extractedLocations.educationalFacilities.length > 0
  ) {
    const facilityResults = await geocodeEducationalFacilities(
      extractedLocations.educationalFacilities,
      context,
      providers,
    );
    processEducationalFacilityResults(facilityResults, qualityMap, addresses);
  }

  return {
    preGeocodedMap,
    qualityMap,
    addresses,
    cadastralGeometries:
      cadastralGeometries.size > 0 ? cadastralGeometries : undefined,
  };
}

/**
 * Geocode pins through provider chain
 */
async function geocodePins(
  pins: Array<{ address: string; coordinates?: Coordinates }>,
  context: GeocodingContext,
  providers: GeocodingProviders,
): Promise<Array<{ pinAddress: string; result: PinResult }>> {
  const results = new Map<string, { pinAddress: string; result: PinResult }>();

  for (const pin of pins) {
    if (pin.coordinates) {
      continue;
    }

    for (const provider of providers.pin) {
      const result = await provider.geocodePin({ location: pin, context });
      if (result) {
        const key = pin.address.toLowerCase().trim();
        results.set(key, { pinAddress: pin.address, result });
        break;
      }
    }
  }

  // Call done() on all providers
  const providerResults = new Map<string, PinResult>(
    Array.from(results.entries()).map(([key, value]) => [key, value.result]),
  );
  for (const provider of providers.pin) {
    if (provider.done) {
      await provider.done(providerResults);
    }
  }

  return Array.from(results.values());
}

/**
 * Geocode streets through provider chain
 */
async function geocodeStreets(
  streets: StreetSection[],
  context: GeocodingContext,
  providers: GeocodingProviders,
): Promise<Array<{ location: StreetSection; result: StreetResult }>> {
  const results = new Map<
    string,
    { location: StreetSection; result: StreetResult }
  >();

  for (const street of streets) {
    if (street.fromCoordinates && street.toCoordinates) {
      continue;
    }

    for (const provider of providers.street) {
      const result = await provider.geocodeStreet({
        location: street,
        context,
      });
      if (result) {
        const key = `${street.street}|${street.from}|${street.to}`;
        results.set(key, { location: street, result });
        break;
      }
    }
  }

  // Call done() on all providers
  const providerResults = new Map<string, StreetResult>(
    Array.from(results.entries()).map(([key, value]) => [key, value.result]),
  );
  for (const provider of providers.street) {
    if (provider.done) {
      await provider.done(providerResults);
    }
  }

  return Array.from(results.values());
}

/**
 * Geocode cadastral properties through provider chain
 */
async function geocodeCadastral(
  properties: CadastralProperty[],
  context: GeocodingContext,
  providers: GeocodingProviders,
): Promise<Array<{ identifier: string; geometry: CadastralGeometry }>> {
  const results = new Map<string, CadastralResult>();

  for (const property of properties) {
    for (const provider of providers.cadastral) {
      const result = await provider.geocodeCadastral({
        location: property,
        context,
      });
      if (result) {
        results.set(property.identifier, result);
        break;
      }
    }
  }

  // Call done() on all providers
  for (const provider of providers.cadastral) {
    if (provider.done) {
      await provider.done(results);
    }
  }

  return Array.from(results.entries()).map(([identifier, result]) => ({
    identifier,
    geometry: result.geometry,
  }));
}

/**
 * Geocode bus stops through provider chain
 */
async function geocodeBusStops(
  stopCodes: string[],
  context: GeocodingContext,
  providers: GeocodingProviders,
): Promise<
  Array<{
    stopCode: string;
    coordinates: Coordinates;
    qualitySignals: QualitySignals;
  }>
> {
  const results = new Map<string, BusStopResult>();

  for (const stopCode of stopCodes) {
    for (const provider of providers.busStop) {
      const result = await provider.geocodeBusStop({
        location: stopCode,
        context,
      });
      if (result) {
        results.set(stopCode, result);
        break;
      }
    }
  }

  // Call done() on all providers
  for (const provider of providers.busStop) {
    if (provider.done) {
      await provider.done(results);
    }
  }

  return Array.from(results.entries()).map(([stopCode, result]) => ({
    stopCode,
    coordinates: result.coordinates,
    qualitySignals: result.qualitySignals,
  }));
}

/**
 * Geocode educational facilities through provider chain
 */
async function geocodeEducationalFacilities(
  facilities: Array<EducationalFacilityRef>,
  context: GeocodingContext,
  providers: GeocodingProviders,
): Promise<
  Array<{
    type: string;
    number: string;
    coordinates: Coordinates;
    qualitySignals: QualitySignals;
  }>
> {
  const results = new Map<
    string,
    { facility: EducationalFacilityRef; result: EducationalFacilityResult }
  >();

  for (const facility of facilities) {
    const facilityKey = `${facility.type}_${facility.number}`;
    for (const provider of providers.educationalFacility) {
      const result = await provider.geocodeEducationalFacility({
        location: facility,
        context,
      });
      if (result) {
        results.set(facilityKey, { facility, result });
        break;
      }
    }
  }

  // Call done() on all providers
  const providerResults = new Map<string, EducationalFacilityResult>(
    Array.from(results.entries()).map(([key, value]) => [key, value.result]),
  );
  for (const provider of providers.educationalFacility) {
    if (provider.done) {
      await provider.done(providerResults);
    }
  }

  return Array.from(results.values()).map(({ facility, result }) => {
    return {
      type: facility.type,
      number: facility.number,
      coordinates: result.coordinates,
      qualitySignals: result.qualitySignals,
    };
  });
}

/**
 * Helper: Convert coordinates to Address object
 */
function coordinatesToAddress(
  originalText: string,
  coordinates: Coordinates,
  qualitySignals: QualitySignals,
): Address {
  return {
    originalText,
    formattedAddress: originalText,
    coordinates,
    geoJson: {
      type: "Point",
      coordinates: [coordinates.lng, coordinates.lat],
    },
    qualitySignals,
  };
}
