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
import type { GeocodingProviders, PinGeocoder, StreetGeocoder, CadastralGeocoder, BusStopGeocoder, EducationalFacilityGeocoder } from "./interfaces";
import { logger } from "@/lib/logger";
import { OverpassStreetGeocoder } from "./street/overpass-street-geocoder";

/**
 * Union type of all available geocoders (used for registry typing).
 */
type AnyGeocoder = PinGeocoder | StreetGeocoder | CadastralGeocoder | BusStopGeocoder | EducationalFacilityGeocoder;

/**
 * Registry of all available provider instances.
 * Keyed by provider ID, values are the actual geocoder instances.
 * Add new providers here as they are implemented in Phase 3+.
 * Forks can override this file to add custom providers.
 */
const PROVIDER_INSTANCES: Record<string, AnyGeocoder> = {
  // Pin providers
  // google: new GooglePinGeocoder(),
  // overpass: new OverpassPinGeocoder(),

  // Street providers
  overpass: new OverpassStreetGeocoder(),

  // Cadastral providers
  // cadastre: new CadastralGeocoder(),

  // Bus stop providers
  // gtfs: new GTFSBusStopGeocoder(),
  // google: new GoogleBusStopGeocoder(),

  // Educational facility providers
  // "educational-facilities": new EducationalFacilityGeocoder(),
  // google: new GoogleEducationalFacilityGeocoder(),
};

/**
 * Resolve and validate a list of provider IDs to instances.
 * Ensures each instance implements the correct method for the entity type.
 * Returns array of instances or throws descriptive error.
 */
function resolveAndValidateProviders(
  entityType: "pin" | "street" | "cadastral" | "busStop" | "educationalFacility",
  priorityIds: readonly string[],
): AnyGeocoder[] {
  // Method name mapping per entity type
  const methodNames: Record<string, string> = {
    pin: "geocodePin",
    street: "geocodeStreet",
    cadastral: "geocodeCadastral",
    busStop: "geocodeBusStop",
    educationalFacility: "geocodeEducationalFacility",
  };

  const methodName = methodNames[entityType];
  const resolved: AnyGeocoder[] = [];

  for (const id of priorityIds) {
    const instance = PROVIDER_INSTANCES[id];

    if (!instance) {
      throw new Error(
        `Provider "${id}" is in GEOCODING_PROVIDER_PRIORITIES.${entityType} ` +
          `but not found in PROVIDER_INSTANCES. Check that the provider is instantiated.`,
      );
    }

    // Validate the instance implements the correct interface for this entity type.
    // Check using Object.entries to avoid type assertions
    let hasMethod = false;
    for (const [key, value] of Object.entries(instance)) {
      if (key === methodName && typeof value === "function") {
        hasMethod = true;
        break;
      }
    }

    if (!hasMethod) {
      throw new Error(
        `Provider instance "${id}" does not implement ${methodName}(). ` +
          `It cannot be used as a ${entityType} geocoder. ` +
          `Check PROVIDER_INSTANCES or the provider class.`,
      );
    }

    resolved.push(instance);
  }

  return resolved;
}

/**
 * Typed wrappers for each entity type (filters AnyGeocoder[] to specific types).
 * These allow buildGeocodingProviders to assign correctly-typed arrays without assertions.
 */
function resolvePinProviders(ids: readonly string[]): PinGeocoder[] {
  return resolveAndValidateProviders("pin", ids).filter(
    (p): p is PinGeocoder => "geocodePin" in p && typeof p.geocodePin === "function",
  );
}

function resolveStreetProviders(ids: readonly string[]): StreetGeocoder[] {
  return resolveAndValidateProviders("street", ids).filter(
    (p): p is StreetGeocoder => "geocodeStreet" in p && typeof p.geocodeStreet === "function",
  );
}

function resolveCadastralProviders(ids: readonly string[]): CadastralGeocoder[] {
  return resolveAndValidateProviders("cadastral", ids).filter(
    (p): p is CadastralGeocoder => "geocodeCadastral" in p && typeof p.geocodeCadastral === "function",
  );
}

function resolveBusStopProviders(ids: readonly string[]): BusStopGeocoder[] {
  return resolveAndValidateProviders("busStop", ids).filter(
    (p): p is BusStopGeocoder => "geocodeBusStop" in p && typeof p.geocodeBusStop === "function",
  );
}

function resolveEducationalFacilityProviders(ids: readonly string[]): EducationalFacilityGeocoder[] {
  return resolveAndValidateProviders("educationalFacility", ids).filter(
    (p): p is EducationalFacilityGeocoder =>
      "geocodeEducationalFacility" in p && typeof p.geocodeEducationalFacility === "function",
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
    cadastral: resolveCadastralProviders(GEOCODING_PROVIDER_PRIORITIES.cadastral),
    busStop: resolveBusStopProviders(GEOCODING_PROVIDER_PRIORITIES.busStop),
    educationalFacility: resolveEducationalFacilityProviders(GEOCODING_PROVIDER_PRIORITIES.educationalFacility),
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
