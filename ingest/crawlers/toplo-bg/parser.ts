import type { ToploIncident, ToploIncidentInfo } from "./types";
import { validateAndFixGeoJSON } from "../shared/geojson-validation";

/**
 * Extract incidents from Toplo.bg HTML containing embedded JavaScript
 */
export function parseIncidents(html: string): ToploIncident[] {
  const incidents: ToploIncident[] = [];

  // Extract all script content
  const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  if (!scriptMatch) {
    return incidents;
  }

  // Find the script containing parseAll function
  const parseAllScript = scriptMatch.find((script) =>
    script.includes("function parseAll()")
  );

  if (!parseAllScript) {
    return incidents;
  }

  // Extract each incident block using regex
  // Pattern: var geoJsonString = '...' var info = {...}
  const incidentPattern =
    /var geoJsonString = '(.+?)'\s*var info = ({[\s\S]+?})\s*if \(geoJsonString/g;

  let match;
  while ((match = incidentPattern.exec(parseAllScript)) !== null) {
    try {
      const [, geoJsonString, infoString] = match;

      // Parse info object - it's already valid JSON with double quotes
      // Handle escaped quotes in string values
      const info: ToploIncidentInfo = JSON.parse(infoString);

      // Parse and validate GeoJSON
      // The source provides an array of features, wrap it in a FeatureCollection
      const rawFeatures = JSON.parse(geoJsonString);
      const rawGeoJson = Array.isArray(rawFeatures)
        ? { type: "FeatureCollection", features: rawFeatures }
        : rawFeatures;
      const validation = validateAndFixGeoJSON(rawGeoJson, info.Name);

      if (!validation.isValid || !validation.geoJson) {
        console.warn(`⚠️  Invalid GeoJSON for incident "${info.Name}":`);
        validation.errors.forEach((err) => console.warn(`   ${err}`));
        continue;
      }

      // Log warnings about coordinate fixes
      if (validation.warnings.length > 0) {
        console.warn(`⚠️  Fixed GeoJSON for incident "${info.Name}":`);
        validation.warnings.forEach((warn) => console.warn(`   ${warn}`));
      }

      incidents.push({ info, geoJson: validation.geoJson });
    } catch (error) {
      console.warn("Failed to parse incident:", (error as Error).message);
      continue;
    }
  }

  return incidents;
}
