import type { GeoJSONFeatureCollection } from "../../lib/types";

/**
 * Raw incident data from Toplo.bg embedded JavaScript
 */
export interface ToploIncidentInfo {
  AccidentId: string;
  Name: string;
  Addresses: string;
  GeolocationSerialized: string;
  Type: number;
  Status: number;
  FromDate: string;
  UntilDate: string | null;
  AffectedService: string | null;
  Region: string;
  Locally: boolean;
  CreatedOn: string;
  ContentItemId: string;
}

/**
 * Parsed incident with GeoJSON
 */
export interface ToploIncident {
  info: ToploIncidentInfo;
  geoJson: GeoJSONFeatureCollection;
}
