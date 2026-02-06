/**
 * Unified geocoding interface - FIXED HYBRID APPROACH
 *
 * Google Geocoding API for pins (specific addresses)
 * OpenStreetMap Overpass API for streets (intersections and geometries)
 * Bulgarian Cadastre API for cadastral properties (УПИ)
 * GTFS for bus stops (public transport)
 */

import { Address, StreetSection, Coordinates } from "./types";
import { logger } from "@/lib/logger";
import { geocodeAddresses as geocodeAddressesTraditional } from "./geocoding-service";
import {
  overpassGeocodeAddresses,
  overpassGeocodeIntersections,
} from "./overpass-geocoding-service";
import {
  geocodeCadastralProperties,
  type CadastralGeometry,
} from "./cadastre-geocoding-service";
import { geocodeBusStops as geocodeBusStopsService } from "./gtfs-geocoding-service";
import { CadastreMockService } from "../__mocks__/services/cadastre-mock-service";

// Check if mocking is enabled for Cadastre
// (Google Geocoding mock is handled in geocoding-service.ts)
// (Overpass mock is handled in overpass-geocoding-service.ts)
const USE_CADASTRE_MOCK = process.env.MOCK_CADASTRE_API === "true";
const cadastreMockService = USE_CADASTRE_MOCK
  ? new CadastreMockService()
  : null;

/**
 * Geocode a list of addresses (pins) using Google Geocoding API
 */
export async function geocodeAddresses(
  addresses: string[],
): Promise<Address[]> {
  return geocodeAddressesTraditional(addresses);
}

/**
 * Geocode street sections using Overpass (geocode endpoints)
 */
export async function geocodeStreets(
  streets: StreetSection[],
): Promise<Address[]> {
  const endpointAddresses = streets.flatMap((s) => [s.from, s.to]);
  return overpassGeocodeAddresses(endpointAddresses);
}

/**
 * Get street geometry (centerline) using Overpass for real OSM geometries
 */
export async function getStreetGeometry(
  streetName: string,
  startCoords: Coordinates,
  endCoords: Coordinates,
): Promise<[number, number][] | null> {
  const { getStreetSectionGeometry } =
    await import("./overpass-geocoding-service");
  const geometry = await getStreetSectionGeometry(
    streetName,
    startCoords,
    endCoords,
  );
  return geometry as [number, number][] | null;
}

/**
 * Geocode street section intersections using Overpass
 */
export async function geocodeIntersectionsForStreets(
  streets: StreetSection[],
): Promise<Map<string, Coordinates>> {
  const geocodedMap = new Map<string, Coordinates>();

  // Extract unique intersections
  const intersectionSet = new Set<string>();
  const intersections: string[] = [];

  streets.forEach((street) => {
    const fromIntersection = `${street.street} ∩ ${street.from}`;
    if (!intersectionSet.has(fromIntersection)) {
      intersectionSet.add(fromIntersection);
      intersections.push(fromIntersection);
    }

    const toIntersection = `${street.street} ∩ ${street.to}`;
    if (!intersectionSet.has(toIntersection)) {
      intersectionSet.add(toIntersection);
      intersections.push(toIntersection);
    }
  });

  const geocoded = await overpassGeocodeIntersections(intersections);

  geocoded.forEach((address) => {
    // Store with the full intersection key (for completeness)
    geocodedMap.set(address.formattedAddress, address.coordinates);

    // ALSO store with just the cross street name (what GeoJSON service expects)
    // Extract the cross street from "ул. A ∩ ул. B" format
    const parts = address.formattedAddress.split(" ∩ ");
    if (parts.length === 2) {
      const crossStreet = parts[1].trim();
      geocodedMap.set(crossStreet, address.coordinates);
    }
  });

  return geocodedMap;
}

/**
 * Geocode cadastral properties using Bulgarian Cadastre API
 */
export async function geocodeCadastralPropertiesFromIdentifiers(
  identifiers: string[],
): Promise<Map<string, CadastralGeometry>> {
  if (identifiers.length === 0) {
    return new Map();
  }

  // Use mock if enabled
  if (USE_CADASTRE_MOCK && cadastreMockService) {
    logger.info("Using Cadastre mock for properties");
    const mockResults =
      await cadastreMockService.geocodeCadastralPropertiesFromIdentifiers(
        identifiers.map((id) => ({ identifier: id, timespans: [] })),
      );
    const resultMap = new Map<string, CadastralGeometry>();
    mockResults.forEach((result, index) => {
      if (result && result.geoJson) {
        resultMap.set(identifiers[index], result.geoJson);
      }
    });
    return resultMap;
  }

  return geocodeCadastralProperties(identifiers);
}

/**
 * Geocode bus stops using GTFS data
 */
export async function geocodeBusStops(stopCodes: string[]): Promise<Address[]> {
  if (stopCodes.length === 0) {
    return [];
  }

  return geocodeBusStopsService(stopCodes);
}
