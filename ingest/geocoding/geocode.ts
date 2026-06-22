/**
 * Main geocoding orchestrator.
 * Coordinates provider chains for all entity types (pins, streets, cadastral, bus stops, facilities).
 *
 * Architecture:
 * - For each entity type, iterate through provider array in order
 * - Call provider.geocode(location) 
 * - Stop at first non-null result
 * - Call provider.done(resultsMap) on all providers after each entity type completes
 * - Pre-geocoded coordinates (geotagged sources) bypass the provider chain
 */

import {
  StreetSection,
  CadastralProperty,
} from "@/lib/types";
import {
  QualitySignals,
  normalizePinAddress,
  EducationalFacilityRef,
} from "@oboapp/shared";
import type { Address, Coordinates } from "@oboapp/shared";
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
  const {
    preGeocodedMap,
    qualityMap,
    addresses,
    cadastralGeometries,
  } = await processAllEntityTypes(context, providers);

  return {
    preGeocodedMap,
    qualityMap,
    addresses,
    cadastralGeometries,
  };
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
    const pinResults = await geocodePins(extractedLocations.pins, context, providers);
    for (const result of pinResults) {
      addresses.push(result.address);
      const key = normalizePinAddress(result.address.originalText);
      qualityMap.set(key, result.address.qualitySignals || { provider: "google", geometryQuality: 0 });
    }
  }

  // Process streets
  if (extractedLocations.streets && extractedLocations.streets.length > 0) {
    const streetResults = await geocodeStreets(
      extractedLocations.streets,
      context,
      providers,
    );
    // Street results are stored in qualityMap keyed by street name + endpoints
    for (const result of streetResults) {
      const key = `${result.location.street}|${result.location.from}|${result.location.to}`;
      qualityMap.set(key, result.result.qualitySignals);
    }
  }

  // Process cadastral properties
  if (extractedLocations.cadastralProperties && extractedLocations.cadastralProperties.length > 0) {
    const cadastralResults = await geocodeCadastral(
      extractedLocations.cadastralProperties,
      context,
      providers,
    );
    for (const result of cadastralResults) {
      cadastralGeometries.set(result.identifier, result.geometry);
    }
  }

  // Process bus stops
  if (extractedLocations.busStops && extractedLocations.busStops.length > 0) {
    const busStopResults = await geocodeBusStops(
      extractedLocations.busStops,
      context,
      providers,
    );
    for (const result of busStopResults) {
      const address = coordinatesToAddress(
        `Спирка ${result.stopCode}`,
        result.coordinates,
        result.qualitySignals,
      );
      addresses.push(address);
      qualityMap.set(`bus_stop_${result.stopCode}`, result.qualitySignals);
    }
  }

  // Process educational facilities
  if (extractedLocations.educationalFacilities && extractedLocations.educationalFacilities.length > 0) {
    const facilityResults = await geocodeEducationalFacilities(
      extractedLocations.educationalFacilities,
      context,
      providers,
    );
    for (const result of facilityResults) {
      const address = coordinatesToAddress(
        `Образователното учреждение ${result.type} ${result.number}`,
        result.coordinates,
        result.qualitySignals,
      );
      addresses.push(address);
      qualityMap.set(`facility_${result.type}_${result.number}`, result.qualitySignals);
    }
  }

  return {
    preGeocodedMap,
    qualityMap,
    addresses,
    cadastralGeometries: cadastralGeometries.size > 0 ? cadastralGeometries : undefined,
  };
}

/**
 * Geocode pins through provider chain
 */
async function geocodePins(
  pins: Array<{ address: string; coordinates?: Coordinates }>,
  context: GeocodingContext,
  providers: GeocodingProviders,
): Promise<PinResult[]> {
  const results = new Map<string, PinResult>();

  for (const pin of pins) {
    for (const provider of providers.pin) {
      const result = await provider.geocode({ location: pin, context });
      if (result) {
        const key = normalizePinAddress(pin.address);
        results.set(key, result);
        break;
      }
    }
  }

  // Call done() on all providers
  for (const provider of providers.pin) {
    if (provider.done) {
      await provider.done(results);
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
  const results = new Map<string, StreetResult>();

  for (const street of streets) {
    for (const provider of providers.street) {
      const result = await provider.geocode({ location: street, context });
      if (result) {
        const key = `${street.street}|${street.from}|${street.to}`;
        results.set(key, result);
        break;
      }
    }
  }

  // Call done() on all providers
  for (const provider of providers.street) {
    if (provider.done) {
      await provider.done(results);
    }
  }

  return Array.from(results.entries()).map(([, result]) => ({
    location: streets.find(s => {
      const key = `${s.street}|${s.from}|${s.to}`;
      return results.has(key);
    })!,
    result,
  }));
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
      const result = await provider.geocode({ location: property, context });
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
): Promise<Array<{ stopCode: string; coordinates: Coordinates; qualitySignals: QualitySignals }>> {
  const results = new Map<string, BusStopResult>();

  for (const stopCode of stopCodes) {
    for (const provider of providers.busStop) {
      const result = await provider.geocode({ location: stopCode, context });
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
): Promise<Array<{ type: string; number: string; coordinates: Coordinates; qualitySignals: QualitySignals }>> {
  const results = new Map<string, EducationalFacilityResult>();

  for (const facility of facilities) {
    const facilityKey = `${facility.type}_${facility.number}`;
    for (const provider of providers.educationalFacility) {
      const result = await provider.geocode({ location: facility, context });
      if (result) {
        results.set(facilityKey, result);
        break;
      }
    }
  }

  // Call done() on all providers
  for (const provider of providers.educationalFacility) {
    if (provider.done) {
      await provider.done(results);
    }
  }

  return Array.from(results.entries()).map(([, result], index) => {
    const facility = facilities[index];
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
