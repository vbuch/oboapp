import type {
  BusStopGeocoder,
  BusStopResult,
  GeocodingContext,
  PinGeocoder,
  PinResult,
  StreetGeocoder,
  StreetResult,
} from "../interfaces";
import type { StreetSection } from "@/lib/types";
import type { Address, Coordinates } from "@oboapp/shared";
import {
  getStreetSectionGeometry,
  overpassGeocodeAddresses,
  overpassGeocodeIntersections,
} from "./service";
import { logger } from "@/lib/logger";
import { gradeOverpass } from "../shared/quality";
import { isHouseNumberEndpoint } from "../shared/house-number";

/**
 * Extract and validate coordinates from resolved addresses
 */
function extractCoordinates(
  fromAddress: Address | null,
  toAddress: Address | null,
): { fromCoordinates: Coordinates | null; toCoordinates: Coordinates | null } {
  const fromCoordinates: Coordinates | null = fromAddress
    ? fromAddress.coordinates
    : null;
  const toCoordinates: Coordinates | null = toAddress
    ? toAddress.coordinates
    : null;

  return { fromCoordinates, toCoordinates };
}

function hasHouseNumber(endpoint: string): boolean {
  return isHouseNumberEndpoint(endpoint);
}

async function resolveStreetEndpoint(
  streetName: string,
  endpoint: string,
): Promise<Address | null> {
  if (hasHouseNumber(endpoint)) {
    const addressQuery = `${streetName} ${endpoint}`;
    const addresses = await overpassGeocodeAddresses([addressQuery]);
    return addresses[0] ?? null;
  }

  const intersectionQuery = `${streetName} ∩ ${endpoint}`;
  const intersections = await overpassGeocodeIntersections([intersectionQuery]);
  return intersections[0] ?? null;
}

/**
 * Fetch and process street geometry
 */
async function fetchStreetGeometry(
  streetName: string,
  fromCoordinates: Coordinates,
  toCoordinates: Coordinates,
): Promise<{
  type: "LineString";
  coordinates: [number, number][];
} | null> {
  try {
    const geometryPositions = await getStreetSectionGeometry(
      streetName,
      fromCoordinates,
      toCoordinates,
    );

    if (geometryPositions && geometryPositions.length >= 2) {
      const coords: Array<[number, number]> = [];
      for (const pos of geometryPositions) {
        coords.push([pos[0], pos[1]]);
      }
      return {
        type: "LineString",
        coordinates: coords,
      };
    }
    return null;
  } catch (err) {
    logger.warn("Overpass street geocoding: geometry retrieval failed", {
      street: streetName,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export class OverpassGeocoder
  implements PinGeocoder, StreetGeocoder, BusStopGeocoder
{
  async geocodePin(args: {
    location: { address: string; coordinates?: Coordinates };
    context: GeocodingContext;
  }): Promise<PinResult | null> {
    const { location } = args;
    const addresses = await overpassGeocodeAddresses([location.address]);
    const first = addresses[0];

    if (!first) {
      return null;
    }

    return { address: first };
  }

  async geocodeStreet(args: {
    location: StreetSection;
    context: GeocodingContext;
  }): Promise<StreetResult | null> {
    const { location } = args;
    const { from: fromEndpoint, to: toEndpoint, street: streetName } = location;

    try {
      logger.debug("Overpass street geocoding: resolving endpoints", {
        street: streetName,
        from: fromEndpoint,
        to: toEndpoint,
      });

      const fromAddress = await resolveStreetEndpoint(streetName, fromEndpoint);
      const toAddress = await resolveStreetEndpoint(streetName, toEndpoint);

      if (!fromAddress && !toAddress) {
        logger.warn(
          "Overpass street geocoding: no endpoint addresses resolved",
          {
            street: streetName,
            from: fromEndpoint,
            to: toEndpoint,
          },
        );
        return null;
      }

      const { fromCoordinates, toCoordinates } = extractCoordinates(
        fromAddress,
        toAddress,
      );

      if (!fromCoordinates || !toCoordinates) {
        logger.warn(
          "Overpass street geocoding: incomplete endpoint resolution",
          {
            street: streetName,
            hasFrom: !!fromCoordinates,
            hasTo: !!toCoordinates,
          },
        );
        return null;
      }

      let geometry: {
        type: "LineString";
        coordinates: [number, number][];
      } | null = null;

      if (fromCoordinates && toCoordinates) {
        geometry = await fetchStreetGeometry(
          streetName,
          fromCoordinates,
          toCoordinates,
        );
      }

      const qualitySignals = geometry
        ? gradeOverpass("way")
        : gradeOverpass("node");

      logger.debug("Overpass street geocoding: success", {
        street: streetName,
        hasFromCoords: !!fromCoordinates,
        hasToCoords: !!toCoordinates,
        hasGeometry: !!geometry,
      });

      return {
        fromCoordinates,
        toCoordinates,
        geometry: geometry ?? undefined,
        qualitySignals,
      };
    } catch (error) {
      logger.error("Overpass street geocoding: unexpected error", {
        street: streetName,
        from: fromEndpoint,
        to: toEndpoint,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async geocodeBusStop(args: {
    location: string;
    context: GeocodingContext;
  }): Promise<BusStopResult | null> {
    const { location } = args;
    const query = `Спирка ${location}`;
    const addresses = await overpassGeocodeAddresses([query]);
    const first = addresses[0];

    if (!first) {
      return null;
    }

    return {
      coordinates: first.coordinates,
      qualitySignals: first.qualitySignals ?? gradeOverpass(),
    };
  }
}
