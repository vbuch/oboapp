/**
 * Geocoding configuration
 */

export type GeocodingAlgorithm =
  | "google_geocoding"
  | "google_directions"
  | "mapbox_geocoding";

// Configuration: Choose which geocoding algorithm to use
// - google_geocoding: Google Geocoding API (reliable for all address types)
// - google_directions: Google Directions API (best for street geometries)
// - mapbox_geocoding: Mapbox Geocoding API (requires SECRET token for server-side use)
export const GEOCODING_ALGO: GeocodingAlgorithm = "mapbox_geocoding";

// Log the active configuration
console.log(`🗺️ Geocoding Algorithm: ${GEOCODING_ALGO}`);

// Get the appropriate data extraction prompt based on geocoding algorithm
export function getDataExtractionPromptPath(): string {
  switch (GEOCODING_ALGO) {
    case "google_directions":
      return "lib/prompts/data-extraction-directions.md";
    case "google_geocoding":
      return "lib/prompts/data-extraction.md";
    case "mapbox_geocoding":
      return "lib/prompts/data-extraction-mapbox.md";
    default:
      return "lib/prompts/data-extraction.md";
  }
}
