/**
 * Street geocoder using OpenStreetMap (Overpass API).
 *
 * Geocodes street sections by:
 * 1. Resolving the two intersection endpoints to coordinates (Overpass)
 * 2. Retrieving the street geometry between those points (Overpass)
 * 3. Returning coordinates + geometry + quality signals
 */

import type { StreetGeocoder, GeocodingContext, StreetResult } from "../interfaces";
import type { StreetSection } from "@/lib/types";
import type { Coordinates } from "@oboapp/shared";
import {
  overpassGeocodeIntersections,
  getStreetSectionGeometry,
} from "../overpass/service";
import { logger } from "@/lib/logger";
import { gradeOverpass } from "../shared/quality";

export class OverpassStreetGeocoder implements StreetGeocoder {
  /**
   * Geocode a street section by resolving its two endpoints and retrieving geometry.
   *
   * @param args - The location (StreetSection with from/to endpoints) and context
   * @returns StreetResult with fromCoordinates, toCoordinates, geometry, and quality signals
   */
  async geocodeStreet(args: {
    location: StreetSection;
    context: GeocodingContext;
  }): Promise<StreetResult | null> {
    const { location } = args;
    const { from: fromEndpoint, to: toEndpoint, street: streetName } = location;

    try {
      // Stage 1: Geocode the two endpoints to get their coordinates
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
        logger.warn("Overpass street geocoding: no endpoint addresses resolved", {
          street: streetName,
          from: fromEndpoint,
          to: toEndpoint,
        });
        return null;
      }

      // Extract coordinates from the two endpoint results
      // If we get only one result, use null for the missing endpoint
      const fromAddress = addresses[0];
      const toAddress = addresses.length > 1 ? addresses[1] : null;

      const fromCoordinates: Coordinates | null = fromAddress
        ? fromAddress.coordinates
        : null;

      const toCoordinates: Coordinates | null = toAddress
        ? toAddress.coordinates
        : null;

      if (!fromCoordinates || !toCoordinates) {
        logger.warn("Overpass street geocoding: incomplete endpoint resolution", {
          street: streetName,
          hasFrom: !!fromCoordinates,
          hasTo: !!toCoordinates,
        });
      }

      // Stage 2: Retrieve street geometry between the two endpoints
      let geometry: { type: "LineString"; coordinates: [number, number][] } | null = null;
      if (fromCoordinates && toCoordinates) {
        try {
          const geometryPositions = await getStreetSectionGeometry(
            streetName,
            fromCoordinates,
            toCoordinates,
          );

          // Convert Position[] to GeoJsonLineString format
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
          // Geometry failure is non-fatal — return coordinates without geometry
        }
      }

      // Assign quality signals
      // For Overpass street geometry: quality 2 (way-level precision from OSM)
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
}
