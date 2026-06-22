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

/**
 * Instantiate all configured providers.
 * Returns empty arrays for all types initially (stubs until Phase 2+).
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

  // TODO: Implement provider instantiation in Phase 2+
  // For now, all arrays are empty stubs.
  // Each provider type (pin, street, cadastral, etc.) will be instantiated
  // based on GEOCODING_PROVIDER_PRIORITIES configuration.

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
