export type {
  GeocodingProviderPriorities,
  GeocodingSourceMetadata,
  OpenDataSource,
} from "./geocoding-source-definition";

import type {
  GeocodingProviderPriorities,
  GeocodingSourceMetadata,
  OpenDataSource,
} from "./geocoding-source-definition";

// ─────────────────────────────────────────────────────────────────────────────
// INSTANCE ASSEMBLY — replace this file in your fork
// ─────────────────────────────────────────────────────────────────────────────
// This file is the DEMO shipped with the upstream repo. It is configured for
// Sofia, Bulgaria. Replace it in your fork to configure geocoding for your city.
//
// When you fork oboapp for your city:
//   1. Replace this file with your own geocoding configuration.
//   2. Set GEOCODING_PROVIDER_PRIORITIES to the providers appropriate for your locality.
//   3. Set GEOCODING_SOURCES to the data sources to display on the web sources page.
//
// See docs/setup/new-locality-instance.md for the full guide.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Geocoding provider priority list — defines which providers are active and in what order.
 * Used by ingest/geocoding/providers.ts to instantiate the provider chain.
 * Also used by web/ to display which providers are active on the sources page.
 */
export const GEOCODING_PROVIDER_PRIORITIES: GeocodingProviderPriorities = {
  pin: ["google", "overpass"],
  street: ["overpass"],
  cadastral: ["cadastre"],
  busStop: ["gtfs", "google"],
  educationalFacility: ["educational-facilities", "google"],
};

/**
 * COMPATIBILITY EXPORT (Phase 5 TODO: Remove after locality-data-sources.ts migration)
 * Converts GEOCODING_PROVIDER_PRIORITIES from the new format to the old discriminated union format.
 * Used by ingest/lib/locality-data-sources.ts for backward compatibility during refactoring.
 * This is a temporary bridge — the new code uses GEOCODING_PROVIDER_PRIORITIES directly.
 */
export const GEOCODING_RESOLVERS = {
  pins: GEOCODING_PROVIDER_PRIORITIES.pin.map((p) => ({ provider: p })),
  streets: GEOCODING_PROVIDER_PRIORITIES.street.map((p) => ({ provider: p })),
  "cadastral-properties": GEOCODING_PROVIDER_PRIORITIES.cadastral.map((p) => ({
    provider: p,
  })),
  "bus-stops": GEOCODING_PROVIDER_PRIORITIES.busStop.map((p) => {
    if (p === "gtfs") {
      // URL will be configured in Phase 4 when providers are instantiated
      return { provider: p, url: process.env.GTFS_URL || "" };
    }
    return { provider: p };
  }),
  "educational-facilities": GEOCODING_PROVIDER_PRIORITIES.educationalFacility.map(
    (p) => {
      if (p === "educational-facilities") {
        // URLs will be configured in Phase 4 when providers are instantiated
        return {
          provider: p,
          "schools-url": process.env.SCHOOLS_URL || "",
          "kindergartens-url": process.env.KINDERGARTENS_URL || "",
        };
      }
      return { provider: p };
    }
  ),
};

/**
 * Open-data sources displayed on the /open-source page.
 * Fork operators replace this with their city's public datasets.
 */
export const OPEN_DATA_SOURCES: readonly OpenDataSource[] = [
  {
    name: "Sofia Traffic GTFS",
    url: "https://gtfs.sofiatraffic.bg",
    description: "спирки и маршрути на градския транспорт",
  },
  {
    name: "Sofia Plan",
    url: "https://sofiaplan.bg",
    description: "училища и детски градини от Столична община",
  },
  {
    name: "OpenStreetMap",
    url: "https://www.openstreetmap.org",
    description: "геокодиране и улична геометрия",
  },
  {
    name: "sensor.community",
    url: "https://sensor.community",
    description: "данни за качеството на въздуха от граждански сензори",
  },
];

/**
 * Geocoding source metadata — displayed on the web sources page.
 * Replaces web/lib/geocoding.json.
 */
export const GEOCODING_SOURCES: readonly GeocodingSourceMetadata[] = [
  { id: "google-maps", name: "Google Maps", url: "https://maps.google.com" },
  {
    id: "bulgarian-cadastre",
    name: "КАИС Портал - Агенция по геодезия, картография и кадастър",
    url: "https://kais.cadastre.bg",
  },
  {
    id: "openstreetmap",
    name: "OpenStreetMap",
    url: "https://www.openstreetmap.org",
  },
  {
    id: "gtfs-sofia-traffic",
    name: "Статични GTFS данни - urbandata.sofia.bg / sofiatraffic.bg",
    url: "https://urbandata.sofia.bg/dataset/gtfs-static",
  },
  {
    id: "sofiaplan-educational-facilities",
    name: "Училища и детски градини - urbandata.sofia.bg / sofiaplan.bg",
    url: "https://sofiaplan.bg",
  },
];
