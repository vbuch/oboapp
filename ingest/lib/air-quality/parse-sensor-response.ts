/**
 * Parser for sensor.community API responses.
 *
 * Handles all the JS-level pitfalls:
 * - sensordatavalues are strings, not numbers
 * - lat/lng can be null
 * - indoor sensors must be excluded
 * - NaN values from "N/A" or malformed strings
 * - PM2.5 truncated to 1 decimal, PM10 to integer
 */

import { isWithinBounds } from "@oboapp/shared";
import { PM_HARD_CAP } from "./constants";

export interface ParsedReading {
  sensorId: number;
  sensorType: string;
  timestamp: Date;
  lat: number;
  lng: number;
  /** PM10 in μg/m³ (truncated to integer) */
  p1: number;
  /** PM2.5 in μg/m³ (truncated to 1 decimal) */
  p2: number;
}

interface SensorDataValue {
  value_type: string;
  value: string;
}

interface ApiSensorEntry {
  id: number;
  sensor: {
    id: number;
    sensor_type?: { name?: string };
  };
  location: {
    id: number;
    latitude: string | null;
    longitude: string | null;
    indoor: number;
  };
  timestamp: string;
  sensordatavalues: SensorDataValue[];
}

/**
 * Parse sensor.community API response into validated readings.
 *
 * @param apiData - Raw JSON array from the sensor.community API
 * @param locality - Locality identifier for bounds checking (e.g., "bg.sofia")
 * @returns Array of validated, parsed readings
 */
export function parseSensorResponse(
  apiData: unknown[],
  locality: string,
): ParsedReading[] {
  const results: ParsedReading[] = [];

  for (const raw of apiData) {
    const entry = raw as ApiSensorEntry;

    // Skip indoor sensors
    if (entry.location?.indoor === 1) continue;

    // Validate coordinates
    const lat = parseFloat(entry.location?.latitude as string);
    const lng = parseFloat(entry.location?.longitude as string);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    // Bounds check
    if (!isWithinBounds(locality, lat, lng)) continue;

    // Extract PM values from sensordatavalues
    let pm10 = NaN;
    let pm25 = NaN;

    for (const sdv of entry.sensordatavalues ?? []) {
      const value = parseFloat(sdv.value);
      if (!Number.isFinite(value) || value < 0) continue;

      // P1 = PM10, P2 = PM2.5 (sensor.community convention)
      if (sdv.value_type === "P1") pm10 = value;
      else if (sdv.value_type === "P2") pm25 = value;
    }

    // Must have at least one valid PM value
    if (!Number.isFinite(pm10) && !Number.isFinite(pm25)) continue;

    // Apply hard cap
    if (pm10 > PM_HARD_CAP || pm25 > PM_HARD_CAP) continue;

    // Truncate per EPA spec: PM2.5 → 1 decimal, PM10 → integer
    const p1 = Number.isFinite(pm10) ? Math.floor(pm10) : 0;
    const p2 = Number.isFinite(pm25)
      ? Math.floor(pm25 * 10) / 10
      : 0;

    const timestamp = new Date(entry.timestamp);
    if (Number.isNaN(timestamp.getTime())) continue;

    results.push({
      sensorId: entry.sensor?.id ?? entry.id,
      sensorType: entry.sensor?.sensor_type?.name ?? "unknown",
      timestamp,
      lat,
      lng,
      p1,
      p2,
    });
  }

  return results;
}
