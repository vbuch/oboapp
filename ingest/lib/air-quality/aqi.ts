/**
 * NowCast AQI calculation.
 *
 * NowCast is the EPA's algorithm for computing real-time AQI from short-term
 * particulate matter data (1-3 hour windows), as opposed to the standard AQI
 * which requires 24-hour averages.
 *
 * Reference: https://usepa.servicenowservices.com/airnow?id=kb_article_view&sys_id=bb8b65ef1b06bc10028420eae54bcb98
 */

import { NOWCAST_MIN_WEIGHT } from "./constants";

/** EPA PM2.5 breakpoints (truncated to 1 decimal) */
const PM25_BREAKPOINTS = [
  { cLow: 0.0, cHigh: 9.0, iLow: 0, iHigh: 50 },
  { cLow: 9.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
  { cLow: 55.5, cHigh: 125.4, iLow: 151, iHigh: 200 },
  { cLow: 125.5, cHigh: 225.4, iLow: 201, iHigh: 300 },
  { cLow: 225.5, cHigh: 325.4, iLow: 301, iHigh: 500 },
] as const;

/** EPA PM10 breakpoints (truncated to integer) */
const PM10_BREAKPOINTS = [
  { cLow: 0, cHigh: 54, iLow: 0, iHigh: 50 },
  { cLow: 55, cHigh: 154, iLow: 51, iHigh: 100 },
  { cLow: 155, cHigh: 254, iLow: 101, iHigh: 150 },
  { cLow: 255, cHigh: 354, iLow: 151, iHigh: 200 },
  { cLow: 355, cHigh: 424, iLow: 201, iHigh: 300 },
  { cLow: 425, cHigh: 604, iLow: 301, iHigh: 500 },
] as const;

interface HourlyAverage {
  pm25: number;
  pm10: number;
}

/**
 * Truncate PM2.5 to 1 decimal place (floor, per EPA spec).
 */
function truncatePm25(value: number): number {
  return Math.floor(value * 10) / 10;
}

/**
 * Truncate PM10 to integer (floor, per EPA spec).
 */
function truncatePm10(value: number): number {
  return Math.floor(value);
}

/**
 * Look up AQI from concentration using EPA piecewise linear breakpoints.
 * Formula: AQI = ((I_high - I_low) / (C_high - C_low)) × (C - C_low) + I_low
 */
function aqiFromBreakpoints(
  concentration: number,
  breakpoints: readonly { cLow: number; cHigh: number; iLow: number; iHigh: number }[],
): number {
  for (const bp of breakpoints) {
    if (concentration >= bp.cLow && concentration <= bp.cHigh) {
      return Math.round(
        ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) *
          (concentration - bp.cLow) +
          bp.iLow,
      );
    }
  }
  // Above all breakpoints — cap at 500
  return 500;
}

/**
 * Compute NowCast weighted concentration from hourly averages.
 *
 * The NowCast algorithm:
 * 1. Find min and max concentrations across available hours
 * 2. Compute weight factor: w = 1 - (range / max), floor at NOWCAST_MIN_WEIGHT
 * 3. Weighted average: Σ(w^i × c_i) / Σ(w^i) where i=0 is most recent
 *
 * Returns NaN if no valid values.
 */
function nowCastWeightedAverage(values: number[]): number {
  const valid = values.filter((v) => !Number.isNaN(v) && v >= 0);
  if (valid.length === 0) return NaN;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min;

  const w = max > 0 ? Math.max(1 - range / max, NOWCAST_MIN_WEIGHT) : 1;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < valid.length; i++) {
    const weight = Math.pow(w, i);
    numerator += weight * valid[i];
    denominator += weight;
  }

  return denominator > 0 ? numerator / denominator : NaN;
}

/**
 * Calculate NowCast AQI from hourly averages.
 *
 * @param hourlyAverages - Array of hourly PM averages, ordered most-recent first.
 *   Missing hours should be omitted (not included as NaN).
 * @returns AQI integer (0-500), or 0 if input is empty/invalid.
 */
export function calculateNowCastAqi(hourlyAverages: HourlyAverage[]): number {
  if (hourlyAverages.length === 0) return 0;

  const pm25Values = hourlyAverages.map((h) => h.pm25);
  const pm10Values = hourlyAverages.map((h) => h.pm10);

  const nowCastPm25 = nowCastWeightedAverage(pm25Values);
  const nowCastPm10 = nowCastWeightedAverage(pm10Values);

  if (Number.isNaN(nowCastPm25) && Number.isNaN(nowCastPm10)) return 0;

  const aqiPm25 = Number.isNaN(nowCastPm25)
    ? 0
    : aqiFromBreakpoints(truncatePm25(nowCastPm25), PM25_BREAKPOINTS);
  const aqiPm10 = Number.isNaN(nowCastPm10)
    ? 0
    : aqiFromBreakpoints(truncatePm10(nowCastPm10), PM10_BREAKPOINTS);

  return Math.max(aqiPm25, aqiPm10);
}

/**
 * Get a human-readable AQI category label (in Bulgarian).
 */
export function getAqiLabel(aqi: number): string {
  if (aqi <= 50) return "Добро";
  if (aqi <= 100) return "Умерено";
  if (aqi <= 150) return "Нездравословно за чувствителни групи";
  if (aqi <= 200) return "Нездравословно";
  if (aqi <= 300) return "Много нездравословно";
  return "Опасно";
}

/**
 * Get AQI category key (for programmatic use).
 */
export function getAqiCategory(
  aqi: number,
): "good" | "moderate" | "unhealthy-sensitive" | "unhealthy" | "very-unhealthy" | "hazardous" {
  if (aqi <= 50) return "good";
  if (aqi <= 100) return "moderate";
  if (aqi <= 150) return "unhealthy-sensitive";
  if (aqi <= 200) return "unhealthy";
  if (aqi <= 300) return "very-unhealthy";
  return "hazardous";
}
