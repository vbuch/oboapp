/**
 * Geocoding providers instance assembly.
 *
 * This file maps provider IDs from GEOCODING_PROVIDER_PRIORITIES to their
 * concrete implementations. Fork operators can override this file to swap
 * providers or adjust provider priority order.
 *
 * Provider-specific configuration (e.g., GTFS URL, Sofia Plan URLs) is
 * passed as constructor arguments — not stored in shared config.
 *
 * Design:
 * - Build a map of all available provider instances (keyed by ID)
 * - For each entity type, iterate through GEOCODING_PROVIDER_PRIORITIES
 * - Look up each provider ID in the map and validate it implements the correct interface
 * - Throw if a required provider ID is missing or wrong type (strict validation)
 * - This scales cleanly to 10+ providers without cascading if-else statements
 */

import { GEOCODING_PROVIDER_PRIORITIES } from "@oboapp/shared";
import type {
  GeocodingProviders,
  PinGeocoder,
  StreetGeocoder,
  CadastralGeocoder,
  BusStopGeocoder,
  EducationalFacilityGeocoder,
} from "./interfaces";
import { logger } from "@/lib/logger";
import { GoogleGeocoder } from "./google/geocoder";
import { OverpassGeocoder } from "./overpass/geocoder";
import { CadastreGeocoder } from "./cadastre/geocoder";
import { GtfsGeocoder } from "./gtfs/geocoder";
import { EducationalFacilitiesGeocoder } from "./educational-facilities/geocoder";

const googleGeocoder = new GoogleGeocoder();
const overpassGeocoder = new OverpassGeocoder();
const cadastreGeocoder = new CadastreGeocoder();
const gtfsGeocoder = new GtfsGeocoder();
const educationalFacilitiesGeocoder = new EducationalFacilitiesGeocoder();

const SKIP_CADASTRAL_PROVIDER: CadastralGeocoder = {
  async geocodeCadastral(): Promise<null> {
    return null;
  },
};

const SKIP_BUS_STOP_PROVIDER: BusStopGeocoder = {
  async geocodeBusStop(): Promise<null> {
    return null;
  },
};

const SKIP_EDUCATIONAL_PROVIDER: EducationalFacilityGeocoder = {
  async geocodeEducationalFacility(): Promise<null> {
    return null;
  },
};

const PIN_PROVIDER_INSTANCES: Record<string, PinGeocoder> = {
  google: googleGeocoder,
  overpass: overpassGeocoder,
};

const STREET_PROVIDER_INSTANCES: Record<string, StreetGeocoder> = {
  overpass: overpassGeocoder,
};

const CADASTRAL_PROVIDER_INSTANCES: Record<string, CadastralGeocoder> = {
  cadastre: cadastreGeocoder,
  skip: SKIP_CADASTRAL_PROVIDER,
};

const BUS_STOP_PROVIDER_INSTANCES: Record<string, BusStopGeocoder> = {
  gtfs: gtfsGeocoder,
  google: googleGeocoder,
  overpass: overpassGeocoder,
  skip: SKIP_BUS_STOP_PROVIDER,
};

const EDUCATIONAL_FACILITY_PROVIDER_INSTANCES: Record<
  string,
  EducationalFacilityGeocoder
> = {
  "educational-facilities": educationalFacilitiesGeocoder,
  google: googleGeocoder,
  skip: SKIP_EDUCATIONAL_PROVIDER,
};

function resolveAndValidateProviders<T>(
  entityType:
    | "pin"
    | "street"
    | "cadastral"
    | "busStop"
    | "educationalFacility",
  priorityIds: readonly string[],
  providerInstances: Record<string, T>,
  methodName: string,
): T[] {
  const resolved: T[] = [];

  for (const id of priorityIds) {
    const instance = providerInstances[id];

    if (!instance) {
      throw new Error(
        `Provider "${id}" is in GEOCODING_PROVIDER_PRIORITIES.${entityType} ` +
          `but not found in PROVIDER_INSTANCES.${entityType}. Check that the provider is instantiated.`,
      );
    }

    const method = Reflect.get(instance, methodName);
    if (typeof method !== "function") {
      throw new TypeError(
        `Provider instance "${id}" does not implement ${methodName}(). ` +
          `It cannot be used as a ${entityType} geocoder. ` +
          `Check PROVIDER_INSTANCES.${entityType} or the provider class.`,
      );
    }

    resolved.push(instance);
  }

  return resolved;
}

function resolvePinProviders(ids: readonly string[]): PinGeocoder[] {
  return resolveAndValidateProviders(
    "pin",
    ids,
    PIN_PROVIDER_INSTANCES,
    "geocodePin",
  );
}

function resolveStreetProviders(ids: readonly string[]): StreetGeocoder[] {
  return resolveAndValidateProviders(
    "street",
    ids,
    STREET_PROVIDER_INSTANCES,
    "geocodeStreet",
  );
}

function resolveCadastralProviders(
  ids: readonly string[],
): CadastralGeocoder[] {
  return resolveAndValidateProviders(
    "cadastral",
    ids,
    CADASTRAL_PROVIDER_INSTANCES,
    "geocodeCadastral",
  );
}

function resolveBusStopProviders(ids: readonly string[]): BusStopGeocoder[] {
  return resolveAndValidateProviders(
    "busStop",
    ids,
    BUS_STOP_PROVIDER_INSTANCES,
    "geocodeBusStop",
  );
}

function resolveEducationalFacilityProviders(
  ids: readonly string[],
): EducationalFacilityGeocoder[] {
  return resolveAndValidateProviders(
    "educationalFacility",
    ids,
    EDUCATIONAL_FACILITY_PROVIDER_INSTANCES,
    "geocodeEducationalFacility",
  );
}

/**
 * Instantiate all configured providers.
 * Resolves provider IDs from GEOCODING_PROVIDER_PRIORITIES to instances.
 * Throws if any required provider is missing or wrong type (strict validation).
 */
export function buildGeocodingProviders(): GeocodingProviders {
  logger.debug("Building geocoding providers", {
    priorities: GEOCODING_PROVIDER_PRIORITIES,
  });

  return {
    pin: resolvePinProviders(GEOCODING_PROVIDER_PRIORITIES.pin),
    street: resolveStreetProviders(GEOCODING_PROVIDER_PRIORITIES.street),
    cadastral: resolveCadastralProviders(
      GEOCODING_PROVIDER_PRIORITIES.cadastral,
    ),
    busStop: resolveBusStopProviders(GEOCODING_PROVIDER_PRIORITIES.busStop),
    educationalFacility: resolveEducationalFacilityProviders(
      GEOCODING_PROVIDER_PRIORITIES.educationalFacility,
    ),
  };
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
