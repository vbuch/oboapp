import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCentroid } from "@/lib/geometry-utils";
import type { GeoJSONFeatureCollection, GeoJSONGeometry } from "@/lib/types";

type HeatmapPoint = [number, number];

/**
 * Convert a single GeoJSON geometry to one or more heatmap points.
 *
 * - Point      → the coordinate itself (1 point)
 * - LineString → turf bounding-box centroid (1 point)
 * - Polygon    → turf bounding-box centroid (1 point)
 * - MultiPoint → each coordinate is a distinct pin (N points)
 *
 * Points are returned in [lat, lng] order (Leaflet convention);
 * GeoJSON stores coordinates as [lng, lat].
 */
function geometryToPoints(geometry: GeoJSONGeometry): HeatmapPoint[] {
  if (geometry.type === "MultiPoint") {
    // Each coordinate in a MultiPoint is a distinct, independent pin
    return geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  }
  // Point, LineString, Polygon → one representative centroid
  const centroid = getCentroid(geometry);
  return centroid ? [[centroid.lat, centroid.lng]] : [];
}

/**
 * Extract coordinate points from a GeoJSON FeatureCollection.
 * Returns one centroid per feature (or one point per coordinate for MultiPoint).
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
 * Returns coordinate points extracted from finalized messages with GeoJSON.
 * Each feature contributes one point (its centroid), except MultiPoint which
 * contributes one point per coordinate. City-wide messages are excluded.
 *
 * Optional query parameters:
 * - `categories` – comma-separated list of category names (including "uncategorized")
 * - `sources`    – comma-separated list of source IDs
 *
 * Performance note: fetches all finalized messages in one query, but requests
 * only the minimal fields to minimise payload size. At the current scale
 * (~5 000 messages) this is fast enough; if the collection grows significantly,
 * consider caching the result or pre-computing the point list.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoriesParam = searchParams.get("categories");
    const sourcesParam = searchParams.get("sources");

    const selectedCategories = categoriesParam
      ? categoriesParam
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
      : null;
    const selectedSources = sourcesParam
      ? sourcesParam
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
      : null;

    const db = await getDb();

    // Use `> new Date(0)` instead of `!= null` for cross-backend consistency:
    // MongoDB's `$ne: null` also matches missing fields, which would include
    // non-finalized messages.
    const docs = await db.messages.findMany({
      where: [{ field: "finalizedAt", op: ">", value: new Date(0) }],
      select: ["_id", "geoJson", "cityWide", "finalizedAt", "categories", "source"],
    });

    const points: HeatmapPoint[] = [];
    let messageCount = 0;
    let oldestDate: string | null = null;

    for (const doc of docs) {
      // Skip city-wide messages — they have no specific geometry
      if (doc.cityWide) continue;

      const geoJson = doc.geoJson as GeoJSONFeatureCollection | null;
      if (!geoJson) continue;

      // Apply category filter when requested
      if (selectedCategories && selectedCategories.length > 0) {
        const docCategories = (doc.categories as string[] | undefined) ?? [];
        const includeUncategorized = selectedCategories.includes("uncategorized");
        const realCategories = selectedCategories.filter(
          (c) => c !== "uncategorized",
        );
        const hasNoCategories = docCategories.length === 0;
        const matchesUncategorized = includeUncategorized && hasNoCategories;
        const matchesCategory =
          realCategories.length > 0 &&
          docCategories.some((cat) => realCategories.includes(cat));

        if (!matchesUncategorized && !matchesCategory) continue;
      }

      // Apply source filter when requested
      if (selectedSources && selectedSources.length > 0) {
        const docSource = doc.source as string | undefined;
        if (!docSource || !selectedSources.includes(docSource)) continue;
      }

      messageCount++;

      // Track oldest finalizedAt among messages that contributed to the heatmap
      const raw = doc.finalizedAt;
      if (raw instanceof Date) {
        const iso = raw.toISOString();
        if (!oldestDate || iso < oldestDate) oldestDate = iso;
      } else if (typeof raw === "string" && raw) {
        if (!oldestDate || raw < oldestDate) oldestDate = raw;
      }

      const docPoints = extractPoints(geoJson);
      points.push(...docPoints);
    }

    return NextResponse.json({ points, messageCount, oldestDate });
  } catch (error) {
    console.error("Error fetching heatmap data:", error);
    return NextResponse.json(
      { error: "Failed to fetch heatmap data" },
      { status: 500 },
    );
  }
}
