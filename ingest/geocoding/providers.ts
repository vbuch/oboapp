/**
 * Geocoding providers instance assembly.
 *
 * This file maps provider IDs from GEOCODING_PROVIDER_PRIORITIES to their
 * concrete implementations. Fork operators can override this file to swap
 * providers or adjust provider priority order.
 *
 * Provider-specific configuration (e.g., GTFS URL, Sofia Plan URLs) is
 * passed as constructor arguments — not stored in shared config.
 */

import { GEOCODING_PROVIDER_PRIORITIES } from "@oboapp/shared";
import type { GeocodingProviders } from "./interfaces";
import { logger } from "@/lib/logger";
import { OverpassStreetGeocoder } from "./street/overpass-street-geocoder";

/**
 * Instantiate all configured providers.
 * Includes Phase 2 providers (street); stubs for Phase 3+.
 */
export function buildGeocodingProviders(): GeocodingProviders {
  const providers: GeocodingProviders = {
    pin: [],
    street: [],
    cadastral: [],
    busStop: [],
    educationalFacility: [],
  };

  logger.debug("Building geocoding providers", {
    priorities: GEOCODING_PROVIDER_PRIORITIES,
  });

  // Phase 2: Street providers
  if (GEOCODING_PROVIDER_PRIORITIES.street) {
    for (const providerId of GEOCODING_PROVIDER_PRIORITIES.street) {
      if (providerId === "overpass") {
        providers.street.push(new OverpassStreetGeocoder());
      }
      // TODO: Add other street providers (e.g., GoogleStreetGeocoder)
    }
  }

  // TODO: Implement Phase 3+ providers (pin, cadastral, busStop, educationalFacility)

  return providers;
}

/**
 * Singleton instance of geocoding providers.
 * Lazily instantiated on first access.
 */
let _providers: GeocodingProviders | null = null;

export function getGeocodingProviders(): GeocodingProviders {
  if (!_providers) {
    _providers = buildGeocodingProviders();
  }
  return _providers;
}
