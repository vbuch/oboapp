import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCentroid } from "@/lib/geometry-utils";
import type { GeoJSONFeatureCollection } from "@/lib/types";

type HeatmapPoint = [number, number];

/**
 * Extract coordinate points from a GeoJSON FeatureCollection.
 * Returns one centroid per feature.
 */
function extractPoints(geoJson: GeoJSONFeatureCollection): HeatmapPoint[] {
  if (!geoJson?.features || !Array.isArray(geoJson.features)) return [];

  const points: HeatmapPoint[] = [];

  for (const feature of geoJson.features) {
    if (!feature?.geometry) continue;
    const centroid = getCentroid(feature.geometry);
    if (centroid) {
      points.push([centroid.lat, centroid.lng]);
    }
  }

  return points;
}

/**
 * GET /api/messages/heatmap
 *
 * Returns all coordinate points extracted from finalized messages with GeoJSON.
 * Each message may contribute multiple points (one per geometry feature).
 * Intended for heatmap visualization of historical message coverage.
 *
 * Performance note: fetches all finalized messages in one query, but requests
 * only the `geoJson` and `cityWide` fields to minimise payload size. At the
 * current scale (~5 000 messages) this is fast enough; if the collection grows
 * significantly, consider caching the result or pre-computing the point list.
 */
export async function GET() {
  try {
    const db = await getDb();

    const docs = await db.messages.findMany({
      where: [{ field: "finalizedAt", op: "!=", value: null }],
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
