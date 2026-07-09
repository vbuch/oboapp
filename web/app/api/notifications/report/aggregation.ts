/**
 * Pure aggregation functions for the notifications report API.
 * No web runtime dependencies — fully unit-testable.
 */

export type HeatmapMode = "all" | "clicked" | "opened";
export type HeatmapPoint = [number, number];

/** Minimum record count required to show heatmap points (privacy threshold). */
export const HEATMAP_PRIVACY_THRESHOLD = 50;

export interface NotificationMatchRecord {
  _id?: unknown;
  userId?: unknown;
  messageId?: unknown;
  notified?: unknown;
  clickedAt?: unknown;
  openedAt?: unknown;
  messageSnapshot?: unknown;
}

export interface SourceBreakdown {
  source: string;
  sent: number;
  clicked: number;
}

export interface ReportAggregation {
  sent: number;
  uniqueUsers: number;
  clicked: number;
  opened: number;
  sources: SourceBreakdown[];
}

export interface HeatmapResult {
  points: HeatmapPoint[];
  heatmapHiddenForPrivacy: boolean;
}

/**
 * Aggregate KPI metrics from a list of notified notification match records.
 */
export function aggregateNotificationKpis(
  matches: NotificationMatchRecord[],
): ReportAggregation {
  const userIds = new Set<string>();
  let clicked = 0;
  let opened = 0;
  const sourceMap = new Map<string, { sent: number; clicked: number }>();

  for (const match of matches) {
    if (typeof match.userId === "string" && match.userId) {
      userIds.add(match.userId);
    }

    if (match.clickedAt) clicked++;
    if (match.openedAt) opened++;

    const source =
      typeof match.messageSnapshot === "object" &&
      match.messageSnapshot !== null &&
      "source" in match.messageSnapshot &&
      typeof match.messageSnapshot.source === "string"
        ? match.messageSnapshot.source
        : "(unknown)";

    const existing = sourceMap.get(source) ?? { sent: 0, clicked: 0 };
    existing.sent++;
    if (match.clickedAt) existing.clicked++;
    sourceMap.set(source, existing);
  }

  const sources: SourceBreakdown[] = Array.from(sourceMap.entries())
    .map(([source, counts]) => ({ source, ...counts }))
    .sort((a, b) => b.sent - a.sent);

  return {
    sent: matches.length,
    uniqueUsers: userIds.size,
    clicked,
    opened,
    sources,
  };
}

/**
 * Filter matches by heatmap mode and extract their messageIds.
 */
export function getMessageIdsForMode(
  matches: NotificationMatchRecord[],
  mode: HeatmapMode,
): string[] {
  return matches
    .filter((m) => {
      if (mode === "clicked") return Boolean(m.clickedAt);
      if (mode === "opened") return Boolean(m.openedAt);
      return true; // "all"
    })
    .map((m) => (typeof m.messageId === "string" ? m.messageId : null))
    .filter((id): id is string => id !== null && id !== "");
}

/**
 * Extract [lat, lng] heatmap points from a message's geoJson field.
 * Returns [lat, lng] order (Leaflet convention).
 * Skips city-wide messages.
 */
export function extractHeatmapPointsFromMessage(message: {
  cityWide?: unknown;
  geoJson?: unknown;
}): HeatmapPoint[] {
  if (message.cityWide) return [];

  const rawGeoJson = message.geoJson;
  if (
    !rawGeoJson ||
    typeof rawGeoJson !== "object" ||
    !("features" in rawGeoJson) ||
    !Array.isArray(rawGeoJson.features)
  ) {
    return [];
  }

  const points: HeatmapPoint[] = [];

  for (const feature of rawGeoJson.features) {
    if (!feature || typeof feature !== "object" || !("geometry" in feature)) continue;
    const geom = feature.geometry;
    if (!geom || typeof geom !== "object" || !("type" in geom) || !("coordinates" in geom)) continue;

    const geomType = geom.type;
    const geomCoords = geom.coordinates;

    if (geomType === "Point" && Array.isArray(geomCoords)) {
      const lng = geomCoords[0];
      const lat = geomCoords[1];
      if (typeof lat === "number" && typeof lng === "number") {
        points.push([lat, lng]);
      }
    } else if (
      (geomType === "MultiPoint" || geomType === "LineString") &&
      Array.isArray(geomCoords)
    ) {
      for (const coord of geomCoords) {
        if (Array.isArray(coord)) {
          const lng = coord[0];
          const lat = coord[1];
          if (typeof lat === "number" && typeof lng === "number") {
            points.push([lat, lng]);
          }
        }
      }
    } else if (geomType === "Polygon" && Array.isArray(geomCoords)) {
      for (const ring of geomCoords) {
        if (Array.isArray(ring)) {
          for (const coord of ring) {
            if (Array.isArray(coord)) {
              const lng = coord[0];
              const lat = coord[1];
              if (typeof lat === "number" && typeof lng === "number") {
                points.push([lat, lng]);
              }
            }
          }
        }
      }
    }
  }

  return points;
}

/**
 * Build heatmap result for a set of messageIds, applying the privacy threshold.
 * Returns empty points and heatmapHiddenForPrivacy=true when count < threshold.
 */
export function buildHeatmapResult(
  matchCount: number,
  pointsFromMessages: HeatmapPoint[],
): HeatmapResult {
  if (matchCount < HEATMAP_PRIVACY_THRESHOLD) {
    return { points: [], heatmapHiddenForPrivacy: true };
  }
  return { points: pointsFromMessages, heatmapHiddenForPrivacy: false };
}
