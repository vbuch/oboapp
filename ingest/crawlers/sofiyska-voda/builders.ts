import type {
  ArcGisFeature,
  LayerConfig,
  SofiyskaVodaSourceDocument,
} from "./types";
import type { GeoJSONFeature, GeoJSONFeatureCollection } from "@/lib/types";
import { sanitizeText, ensureDate, buildMessage } from "./formatters";

// Re-export for backward compatibility
export { buildMessage } from "./formatters";

const SOURCE_TYPE = "sofiyska-voda";
const BASE_URL =
  "https://gispx.sofiyskavoda.bg/arcgis/rest/services/WSI_PUBLIC/InfoCenter_Public/MapServer";

type FeatureProperty = string | number;
type NullableFeatureProperty = FeatureProperty | null;

/**
 * Build URL for a specific feature
 */
export function getFeatureUrl(layerId: number, objectId: number): string {
  return `${BASE_URL}/${layerId}/${objectId}`;
}

/**
 * Build title from feature attributes
 */
export function buildTitle(
  attributes: ArcGisFeature["attributes"],
  layer: LayerConfig
): string {
  const parts = [
    layer.titlePrefix,
    sanitizeText(attributes?.LOCATION),
    sanitizeText(attributes?.ALERTTYPE),
  ].filter(Boolean) as string[];

  if (parts.length === 0 && attributes?.ALERTID) {
    parts.push(`Инцидент ${attributes.ALERTID}`);
  }

  return (
    parts.join(" – ") ||
    `${layer.titlePrefix} ${attributes?.OBJECTID ?? ""}`.trim()
  );
}

/**
 * Build GeoJSON feature properties
 */
export function buildFeatureProperties(
  attributes: ArcGisFeature["attributes"],
  layer: LayerConfig
): Record<string, FeatureProperty> {
  const sanitized = (
    value?: NullableFeatureProperty
  ): NullableFeatureProperty => {
    if (typeof value === "string") {
      return sanitizeText(value);
    }
    return value ?? null;
  };

  const rawEntries: [string, NullableFeatureProperty][] = [
    ["layerId", layer.id],
    ["layerName", layer.name],
    ["titlePrefix", layer.titlePrefix],
    ["alertId", attributes?.ALERTID ?? null],
    ["status", sanitized(attributes?.ACTIVESTATUS) ?? null],
    ["alertType", sanitized(attributes?.ALERTTYPE) ?? null],
    ["location", sanitized(attributes?.LOCATION) ?? null],
    ["district", attributes?.SOFIADISTRICT ?? null],
  ];

  const filteredEntries: [string, FeatureProperty][] = rawEntries
    .filter(([, value]) => value !== null && value !== "")
    .map(([key, value]) => [key, value as FeatureProperty]);

  return Object.fromEntries(filteredEntries);
}

/**
 * Create a FeatureCollection from a single feature
 */
export function createFeatureCollection(
  feature: GeoJSONFeature
): GeoJSONFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [feature],
  };
}

/**
 * Build GeoJSON FeatureCollection from ArcGIS feature
 */
export function buildGeoJsonFeatureCollection(
  feature: ArcGisFeature,
  layer: LayerConfig
): GeoJSONFeatureCollection | null {
  const geometry = feature.geometry;
  if (!geometry) {
    return null;
  }

  const properties = buildFeatureProperties(feature.attributes ?? {}, layer);

  if (geometry.rings?.length) {
    return createFeatureCollection({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: geometry.rings as [number, number][][],
      },
      properties,
    });
  }

  if (geometry.paths?.length) {
    const firstPath = geometry.paths.find((path) => path.length > 1);
    if (firstPath) {
      return createFeatureCollection({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: firstPath as [number, number][],
        },
        properties,
      });
    }
  }

  if (typeof geometry.x === "number" && typeof geometry.y === "number") {
    return createFeatureCollection({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [geometry.x, geometry.y],
      },
      properties,
    });
  }

  return null;
}

/**
 * Build complete SourceDocument from ArcGIS feature
 */
export function buildSourceDocument(
  feature: ArcGisFeature,
  layer: LayerConfig,
  dateFormatter?: Intl.DateTimeFormat
): SofiyskaVodaSourceDocument | null {
  const objectId = feature.attributes?.OBJECTID;
  if (typeof objectId !== "number") {
    console.warn(`⚠️ Skipping feature without OBJECTID in layer ${layer.id}`);
    return null;
  }

  const url = getFeatureUrl(layer.id, objectId);
  const message = buildMessage(
    feature.attributes as Record<string, unknown>,
    layer,
    dateFormatter
  );
  const geoJson = buildGeoJsonFeatureCollection(feature, layer);
  if (!geoJson) {
    console.warn(`⚠️ Skipping feature without geometry: ${url}`);
    return null;
  }
  const lastUpdate =
    ensureDate(feature.attributes?.LASTUPDATE) ??
    ensureDate(feature.attributes?.START_) ??
    new Date();

  return {
    url,
    datePublished: lastUpdate.toISOString(),
    title: buildTitle(feature.attributes, layer),
    message,
    markdownText: message, // Store markdown in markdownText field
    sourceType: SOURCE_TYPE,
    crawledAt: new Date(),
    geoJson,
    categories: ["water"],
    isRelevant: true,
  };
}
