/**
 * Geocoder interfaces — defining the contract for all location type providers
 *
 * Each geocoder type (pin, street, cadastral, bus stop, educational facility)
 * implements one of these interfaces. A geocoder receives a single location,
 * attempts to resolve it to coordinates/geometry, and returns a result or null.
 *
 * The optional `done()` callback is invoked after all locations of that type
 * have been processed. This is the hook for future caching implementations.
 */

import type {
  Address,
  Coordinates,
  QualitySignals,
  GeoJsonLineString,
  EducationalFacilityRef,
} from "@oboapp/shared";
import type { CadastralGeometry } from "@/geocoding/cadastre/service";
import type { ExtractedLocations, StreetSection, CadastralProperty } from "@/lib/types";

/**
 * Context passed to each geocoder.
 * Contains the extracted location and locality information.
 */
export interface GeocodingContext {
  locality: string;
  extractedLocations: ExtractedLocations;
}

/**
 * Pin (specific address) geocoder result
 */
export interface PinResult {
  address: Address;
}

/**
 * Street section geocoder result.
 * Contains coordinates for the "from" and "to" endpoints of the section.
 */
export interface StreetResult {
  fromCoordinates: Coordinates | null;
  toCoordinates: Coordinates | null;
  geometry?: GeoJsonLineString; // Optional geometry from provider
  qualitySignals: QualitySignals;
}

/**
 * Cadastral property (УПИ) geocoder result
 */
export interface CadastralResult {
  geometry: CadastralGeometry;
}

/**
 * Bus stop geocoder result
 */
export interface BusStopResult {
  coordinates: Coordinates;
  qualitySignals: QualitySignals;
}

/**
 * Educational facility geocoder result
 */
export interface EducationalFacilityResult {
  coordinates: Coordinates;
  qualitySignals: QualitySignals;
}

/**
 * Pin geocoder interface.
 * Geocodes a single address pin and returns Address + quality info or null.
 */
export interface PinGeocoder {
  geocode(args: {
    location: { address: string; coordinates?: Coordinates };
    context: GeocodingContext;
  }): Promise<PinResult | null>;

  /**
   * Optional callback invoked after all pins are processed.
   * Used by caching implementations to update their caches.
   */
  done?(results: Map<string, PinResult>): Promise<void>;
}

/**
 * Street geocoder interface.
 * Geocodes a street section (from/to intersection) and returns coordinates + geometry.
 */
export interface StreetGeocoder {
  geocode(args: {
    location: StreetSection;
    context: GeocodingContext;
  }): Promise<StreetResult | null>;

  /**
   * Optional callback invoked after all streets are processed.
   * Used by caching implementations to update their caches.
   */
  done?(results: Map<string, StreetResult>): Promise<void>;
}

/**
 * Cadastral property (УПИ identifier) geocoder interface.
 */
export interface CadastralGeocoder {
  geocode(args: {
    location: CadastralProperty;
    context: GeocodingContext;
  }): Promise<CadastralResult | null>;

  /**
   * Optional callback invoked after all cadastral properties are processed.
   */
  done?(results: Map<string, CadastralResult>): Promise<void>;
}

/**
 * Bus stop geocoder interface.
 */
export interface BusStopGeocoder {
  geocode(args: {
    location: string; // stop code
    context: GeocodingContext;
  }): Promise<BusStopResult | null>;

  /**
   * Optional callback invoked after all bus stops are processed.
   */
  done?(results: Map<string, BusStopResult>): Promise<void>;
}

/**
 * Educational facility geocoder interface.
 */
export interface EducationalFacilityGeocoder {
  geocode(args: {
    location: EducationalFacilityRef;
    context: GeocodingContext;
  }): Promise<EducationalFacilityResult | null>;

  /**
   * Optional callback invoked after all educational facilities are processed.
   */
  done?(results: Map<string, EducationalFacilityResult>): Promise<void>;
}

/**
 * Aggregated provider collection.
 * Maps each entity type to an ordered array of providers (tried in sequence until one succeeds).
 */
export interface GeocodingProviders {
  pin: PinGeocoder[];
  street: StreetGeocoder[];
  cadastral: CadastralGeocoder[];
  busStop: BusStopGeocoder[];
  educationalFacility: EducationalFacilityGeocoder[];
}

/**
 * Result of geocoding all extracted locations.
 * Maps locations to their resolved coordinates and quality metadata.
 */
export interface GeocodingResult {
  preGeocodedMap: Map<string, Coordinates>;
  qualityMap: Map<string, QualitySignals>;
  addresses: Address[];
  cadastralGeometries?: Map<string, CadastralGeometry>;
}
