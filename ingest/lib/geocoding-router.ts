/**
 * Unified geocoding interface - FIXED HYBRID APPROACH
 *
 * Google Geocoding API for pins (specific addresses)
 * OpenStreetMap Overpass API for streets (intersections and geometries)
 * Bulgarian Cadastre API for cadastral properties (УПИ)
 * GTFS for bus stops (public transport)
 */

import { Address, StreetSection } from "./types";
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
  startCoords: { lat: number; lng: number },
  endCoords: { lat: number; lng: number },
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
): Promise<Map<string, { lat: number; lng: number }>> {
  const geocodedMap = new Map<string, { lat: number; lng: number }>();

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
