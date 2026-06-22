/** TypeScript interface definitions for geocoding provider configuration */

// Provider type identifiers
export type PinProviderId = "google" | "overpass";
export type StreetProviderId = "overpass" | "google";
export type CadastralProviderId = "cadastre" | "skip";
export type BusStopProviderId = "gtfs" | "google" | "overpass" | "skip";
export type EducationalFacilityProviderId = "educational-facilities" | "google" | "skip";

/**
 * Ordered provider priority lists for each location type.
 * 
 * Replaces the old GeocodingResolverConfig which specified a single provider per type.
 * Now each type has an ordered array of provider IDs, and the system tries them
 * in sequence until one succeeds.
 * 
 * Fork operators replace this configuration for their city's setup.
 */
export interface GeocodingProviderPriorities {
  readonly pin: ReadonlyArray<PinProviderId>;
  readonly street: ReadonlyArray<StreetProviderId>;
  readonly cadastral: ReadonlyArray<CadastralProviderId>;
  readonly busStop: ReadonlyArray<BusStopProviderId>;
  readonly educationalFacility: ReadonlyArray<EducationalFacilityProviderId>;
}

export interface GeocodingSourceMetadata {
  readonly id: string;
  readonly name: string;
  readonly url: string;
}

/** Shape of an open-data source entry displayed on the /open-source page */
export interface OpenDataSource {
  readonly name: string;
  readonly url: string;
  readonly description: string;
}
