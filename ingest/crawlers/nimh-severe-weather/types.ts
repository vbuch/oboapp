/**
 * Warning level for weather alerts (color-coded severity)
 */
export type WarningLevel = "green" | "yellow" | "orange" | "red";

/**
 * Weather warning column types from the table
 */
export type WarningType =
  | "high_temperature"
  | "low_temperature"
  | "wind"
  | "rain"
  | "snow_ice";

/**
 * A single warning cell from the table
 */
export interface WarningCell {
  type: WarningType;
  level: WarningLevel;
  notes: string[];
}

/**
 * Parsed weather warning for a municipality
 */
export interface WeatherWarning {
  /** Municipality name (e.g., "Столична") */
  municipality: string;
  /** Forecast date in YYYY-MM-DD format */
  forecastDate: string;
  /** Date when the warning was issued */
  issuedAt: string;
  /** Main warning text/recommendation (e.g., "Снеговалежи и образуване на снежна покривка до 10 cm.") */
  recommendation: string;
  /** Individual warning cells by type */
  warnings: WarningCell[];
}

/**
 * Parsed page data from weather.bg
 */
export interface WeatherPageData {
  /** Forecast date in YYYY-MM-DD format */
  forecastDate: string;
  /** Date when the forecast was issued */
  issuedAt: string;
  /** Main recommendation text */
  recommendation: string;
  /** Warnings for Sofia municipality */
  sofiaWarnings: WarningCell[];
}
