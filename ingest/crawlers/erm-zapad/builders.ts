import type { GeoJSONFeature, GeoJSONFeatureCollection } from "@/lib/types";
import type { RawIncident } from "./types";
import { createGeometry } from "./geometry";

/**
 * Build GeoJSON FeatureCollection from incident
 */
export function buildGeoJSON(
  incident: RawIncident,
): GeoJSONFeatureCollection | null {
  const geometry = createGeometry(incident);
  if (!geometry) {
    return null;
  }

  const feature: GeoJSONFeature = {
    type: "Feature",
    geometry: geometry as GeoJSONFeature["geometry"], // Type assertion for MultiPoint compatibility
    properties: {
      eventId: incident.ceo,
      cityName: incident.city_name,
      eventType: incident.typedist,
      startTime: incident.begin_event, // Bulgarian format for display
      endTime: incident.end_event, // Bulgarian format for display
    },
  };

  return {
    type: "FeatureCollection",
    features: [feature],
  };
}

/**
 * Build markdown message for incident
 */
export function buildMessage(incident: RawIncident): string {
  const lines: string[] = [];

  // Title
  lines.push(`**${incident.typedist}**\n`);

  // Location
  if (incident.city_name) {
    lines.push(`**Населено място:** ${incident.city_name}`);
  }

  // Time range
  if (incident.begin_event) {
    lines.push(`**Начало:** ${incident.begin_event}`);
  }
  if (incident.end_event) {
    lines.push(`**Край:** ${incident.end_event}`);
  }

  // Grid identifier
  if (incident.ceo) {
    lines.push(`**Мрежов код:** ${incident.ceo}`);
  }

  return lines.join("\n");
}

/**
 * Build title for incident
 */
export function buildTitle(incident: RawIncident): string {
  const parts: string[] = [];

  // Incident type
  parts.push(incident.typedist);

  // Location
  if (incident.city_name) {
    parts.push(incident.city_name);
  }

  // Grid code
  if (incident.ceo) {
    parts.push(incident.ceo);
  }

  return parts.join(" - ");
}
