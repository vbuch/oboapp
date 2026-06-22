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
import type { Coordinates } from "@oboapp/shared";
import {
  getStreetSectionGeometry,
  overpassGeocodeAddresses,
  overpassGeocodeIntersections,
} from "./service";
import { logger } from "@/lib/logger";
import { gradeOverpass } from "../shared/quality";

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

      const addresses = await overpassGeocodeIntersections([
        fromEndpoint,
        toEndpoint,
      ]);

      if (addresses.length === 0) {
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

      const fromAddress = addresses[0];
      const toAddress = addresses.length > 1 ? addresses[1] : null;

      const fromCoordinates: Coordinates | null = fromAddress
        ? fromAddress.coordinates
        : null;
      const toCoordinates: Coordinates | null = toAddress
        ? toAddress.coordinates
        : null;

      if (!fromCoordinates || !toCoordinates) {
        logger.warn(
          "Overpass street geocoding: incomplete endpoint resolution",
          {
            street: streetName,
            hasFrom: !!fromCoordinates,
            hasTo: !!toCoordinates,
          },
        );
      }

      let geometry: {
        type: "LineString";
        coordinates: [number, number][];
      } | null = null;

      if (fromCoordinates && toCoordinates) {
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
            geometry = {
              type: "LineString",
              coordinates: coords,
            };
          }
        } catch (err) {
          logger.warn("Overpass street geocoding: geometry retrieval failed", {
            street: streetName,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const qualitySignals = gradeOverpass("way");

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
