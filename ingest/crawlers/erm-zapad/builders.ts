import type { GeoJSONFeature, GeoJSONFeatureCollection } from "@/lib/types";
import type { PinRecord } from "./types";

/**
 * Build GeoJSON FeatureCollection with separate Point for each pin
 */
export function buildGeoJSON(
  pinRecords: PinRecord[],
): GeoJSONFeatureCollection | null {
  if (pinRecords.length === 0) {
    return null;
  }

  const features: GeoJSONFeature[] = pinRecords.map((pin) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [pin.lon, pin.lat], // GeoJSON: [lng, lat]
    },
    properties: {
      eventId: pin.eventId,
      cityName: pin.city_name,
      eventType: pin.typedist,
      startTime: pin.begin_event,
      endTime: pin.end_event,
    },
  }));

  return {
    type: "FeatureCollection",
    features,
  };
}

/**
 * Build markdown message for pin
 */
export function buildMessage(pin: PinRecord): string {
  const lines: string[] = [];

  // Title
  lines.push(`**${pin.typedist}**\n`);

  // Location
  if (pin.city_name) {
    lines.push(`**Населено място:** ${pin.city_name}`);
  }

  // Time range
  if (pin.begin_event) {
    lines.push(`**Начало:** ${pin.begin_event}`);
  }
  if (pin.end_event) {
    lines.push(`**Край:** ${pin.end_event}`);
  }

  // Grid identifier
  if (pin.eventId) {
    lines.push(`**Мрежов код:** ${pin.eventId}`);
  }

  return lines.join("\n");
}

/**
 * Build title for pin
 */
export function buildTitle(pin: PinRecord): string {
  const parts: string[] = [];

  // Incident type
  parts.push(pin.typedist);

  // Location
  if (pin.city_name) {
    parts.push(pin.city_name);
  }

  // Grid code
  if (pin.eventId) {
    parts.push(pin.eventId);
  }

  return parts.join(" - ");
}
