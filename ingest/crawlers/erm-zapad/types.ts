import { SourceDocumentWithGeoJson } from "../shared/types";

/**
 * Polygon vertex with coordinates (for map visualization)
 */
export interface PolygonVertex {
  lat: string;
  lon: string;
}

/**
 * Points object containing polygon vertices for visualization
 */
export interface IncidentPoints {
  cnt: string; // Count of polygon vertices
  [key: string]: string | PolygonVertex; // Numbered vertices: "1", "2", "3", etc.
}

/**
 * Raw incident data from ERM-Zapad API
 */
export interface RawIncident {
  ceo: string; // Grid identifier (e.g., "SF_2742")
  lat: string; // Center latitude
  lon: string; // Center longitude
  typedist: string; // Incident type: "планирано" or "непланирано"
  type_event: string; // Event type code
  begin_event: string; // Start datetime (format: "DD.MM.YYYY HH:MM")
  end_event: string; // End datetime (format: "DD.MM.YYYY HH:MM")
  city_name: string; // Settlement name
  grid_id: string; // Grid ID (often empty)
  cities: string; // Affected cities (often empty)
  points: IncidentPoints; // Customer point locations
}

/**
 * API response format: object with incident IDs as keys
 */
export interface ApiResponse {
  [incidentId: string]: RawIncident;
}

/**
 * Municipality information
 */
export interface Municipality {
  code: string; // e.g., "SOF15", "SOF16"
  name: string; // e.g., "ИСКЪР", "ПАНЧАРЕВО"
}

/**
 * Source document for ERM-Zapad incidents (stored in Firestore)
 */
export interface ErmZapadSourceDocument extends SourceDocumentWithGeoJson {
  sourceType: "erm-zapad";
}

/**
 * Crawl summary statistics
 */
export interface CrawlSummary {
  saved: number;
  skipped: number;
  failed: number;
}

/**
 * Deduplicated pin record with incident properties
 */
export interface PinRecord {
  lat: number; // Rounded to 6 decimals
  lon: number; // Rounded to 6 decimals
  eventId: string; // CEO identifier (e.g., "SF_7650")
  typedist: string; // "планирано" or "непланирано"
  begin_event: string; // Bulgarian datetime format
  end_event: string; // Bulgarian datetime format
  city_name: string; // Settlement name
  cities: string; // Affected cities
}
