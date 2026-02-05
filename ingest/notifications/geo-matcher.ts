import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as turf from "@turf/turf";
import type { Message, Interest, GeoJSONFeatureCollection } from "@/lib/types";

// Cache Sofia GeoJSON
let sofiaGeoJson: GeoJSONFeatureCollection | null = null;

/**
 * Load Sofia administrative boundary GeoJSON (cached)
 */
function loadSofiaGeoJson(): GeoJSONFeatureCollection {
  if (!sofiaGeoJson) {
    const sofiaPath = resolve(process.cwd(), "sofia.geojson");
    const content = readFileSync(sofiaPath, "utf-8");
    sofiaGeoJson = JSON.parse(content) as GeoJSONFeatureCollection;
  }
  return sofiaGeoJson;
}

/**
 * Check if a message's GeoJSON features intersect with a user's interest circle
 * For city-wide messages (cityWide flag), uses sofia.geojson for geometric matching
 */
export function matchMessageToInterest(
  message: Message,
  interest: Interest,
): { matches: boolean; distance: number | null } {
  // City-wide messages use Sofia boundary for matching
  let geoJson = message.geoJson;
  if (message.cityWide) {
    geoJson = loadSofiaGeoJson();
  }

  if (!geoJson?.features || geoJson.features.length === 0) {
    return { matches: false, distance: null };
  }

  const interestPoint = turf.point([
    interest.coordinates.lng,
    interest.coordinates.lat,
  ]);
  const interestCircle = turf.circle(
    interestPoint,
    interest.radius / 1000, // Convert meters to kilometers
    { units: "kilometers" },
  );

  let minDistance: number | null = null;

  for (const feature of geoJson.features) {
    try {
      // Check if feature intersects with interest circle
      const intersects = turf.booleanIntersects(feature, interestCircle);

      if (intersects) {
        // Calculate distance to get the closest point using pointToLineDistance or centroid
        let distance: number;
        if (feature.geometry.type === "Point") {
          distance = turf.distance(
            interestPoint,
            feature.geometry.coordinates,
            { units: "meters" },
          );
        } else {
          // For LineString and Polygon, calculate distance to centroid
          const centroid = turf.centroid(feature);
          distance = turf.distance(interestPoint, centroid, {
            units: "meters",
          });
        }

        if (minDistance === null || distance < minDistance) {
          minDistance = distance;
        }
      }
    } catch (error) {
      console.warn(`   ⚠️  Error checking intersection for feature:`, error);
    }
  }

  return { matches: minDistance !== null, distance: minDistance };
}
