import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { GeoJSONFeatureCollection, GeoJSONGeometry } from "@/lib/types";

type HeatmapPoint = [number, number];

/**
 * Extract every coordinate vertex from a single GeoJSON geometry as heatmap
 * points in [lat, lng] order (note: GeoJSON stores [lng, lat]).
 *
 * - Point      → one point
 * - LineString → one point per vertex (captures the full shape of each street)
 * - Polygon    → one point per outer-ring vertex
 */
function geometryToPoints(geometry: GeoJSONGeometry): HeatmapPoint[] {
  switch (geometry.type) {
    case "Point": {
      const [lng, lat] = geometry.coordinates;
      return [[lat, lng]];
    }
    case "LineString": {
      return geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    }
    case "Polygon": {
      // Use the outer ring (index 0); holes are not needed for heatmap density
      return (geometry.coordinates[0] ?? []).map(([lng, lat]) => [lat, lng]);
    }
    default:
      return [];
  }
}

/**
 * Extract coordinate points from a GeoJSON FeatureCollection.
 * Returns all vertices from every feature so that streets and polygons
 * are fully represented on the heatmap (not just their centroid).
 */
function extractPoints(geoJson: GeoJSONFeatureCollection): HeatmapPoint[] {
  if (!geoJson?.features || !Array.isArray(geoJson.features)) return [];

  const points: HeatmapPoint[] = [];
  for (const feature of geoJson.features) {
    if (!feature?.geometry) continue;
    points.push(...geometryToPoints(feature.geometry));
  }
  return points;
}

/**
 * GET /api/messages/heatmap
 *
 * Returns all coordinate points extracted from finalized messages with GeoJSON.
 * Each feature contributes one point per vertex so that streets and polygons
 * are faithfully represented on the heatmap at all zoom levels.
 *
 * Performance note: fetches all finalized messages in one query, but requests
 * only the `geoJson` and `cityWide` fields to minimise payload size. At the
 * current scale (~5 000 messages) this is fast enough; if the collection grows
 * significantly, consider caching the result or pre-computing the point list.
 */
export async function GET() {
  try {
    const db = await getDb();

    // Use `> new Date(0)` instead of `!= null` for cross-backend consistency:
    // MongoDB's `$ne: null` also matches missing fields, which would include
    // non-finalized messages.
    const docs = await db.messages.findMany({
      where: [{ field: "finalizedAt", op: ">", value: new Date(0) }],
      select: ["_id", "geoJson", "cityWide"],
    });

    const points: HeatmapPoint[] = [];

    for (const doc of docs) {
      // Skip city-wide messages — they have no specific geometry
      if (doc.cityWide) continue;

      const geoJson = doc.geoJson as GeoJSONFeatureCollection | null;
      if (!geoJson) continue;

      const docPoints = extractPoints(geoJson);
      points.push(...docPoints);
    }

    return NextResponse.json({ points });
  } catch (error) {
    console.error("Error fetching heatmap data:", error);
    return NextResponse.json(
      { error: "Failed to fetch heatmap data" },
      { status: 500 },
    );
  }
}
