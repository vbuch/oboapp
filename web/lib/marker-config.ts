/**
 * Marker icon and geometry style configuration utilities
 * Extracted from GeoJSONLayer for better reusability and testing
 */

import { colors, opacity } from "@/lib/colors";

/**
 * Default GeoJSON styles for different geometry types and states
 */
export const GEOJSON_STYLES = {
  // Active (today) styles - Red
  lineString: {
    strokeColor: colors.primary.red,
    strokeOpacity: opacity.default,
    strokeWeight: 3,
    zIndex: 5,
  },
  lineStringHover: {
    strokeColor: colors.primary.red,
    strokeOpacity: opacity.hover,
    strokeWeight: 4,
    zIndex: 6,
  },
  polygon: {
    strokeColor: colors.primary.red,
    strokeOpacity: opacity.default,
    strokeWeight: 2,
    fillColor: colors.primary.red,
    fillOpacity: opacity.fill,
    zIndex: 5,
  },
  polygonHover: {
    strokeColor: colors.primary.red,
    strokeOpacity: opacity.hover,
    strokeWeight: 3,
    fillColor: colors.primary.red,
    fillOpacity: opacity.fillHover,
    zIndex: 6,
  },
  // Archived (past 7 days) styles - Grey
  lineStringArchived: {
    strokeColor: colors.primary.grey,
    strokeOpacity: opacity.archivedDefault,
    strokeWeight: 3,
    zIndex: 3,
  },
  lineStringArchivedHover: {
    strokeColor: colors.primary.grey,
    strokeOpacity: opacity.archivedHover,
    strokeWeight: 4,
    zIndex: 4,
  },
  polygonArchived: {
    strokeColor: colors.primary.grey,
    strokeOpacity: opacity.archivedDefault,
    strokeWeight: 2,
    fillColor: colors.primary.grey,
    fillOpacity: opacity.archivedFill,
    zIndex: 3,
  },
  polygonArchivedHover: {
    strokeColor: colors.primary.grey,
    strokeOpacity: opacity.archivedHover,
    strokeWeight: 3,
    fillColor: colors.primary.grey,
    fillOpacity: opacity.archivedFillHover,
    zIndex: 4,
  },
} as const;

/**
 * Configuration for marker icons
 */
export interface MarkerIconConfig {
  readonly path: string;
  readonly fillColor: string;
  readonly fillOpacity: number;
  readonly strokeWeight: number;
  readonly strokeColor: string;
  readonly scale: number;
}

/**
 * Configuration for cluster marker icons
 */
export interface ClusterIconConfig {
  readonly path: string | google.maps.SymbolPath;
  readonly fillColor: string;
  readonly fillOpacity: number;
  readonly strokeColor: string;
  readonly strokeWeight: number;
  readonly scale: number;
}

/**
 * Configuration for cluster marker labels
 */
export interface ClusterLabelConfig {
  readonly text: string;
  readonly color: string;
  readonly fontSize: string;
  readonly fontWeight: string;
}

/**
 * Geometry style configuration
 */
export interface GeometryStyleConfig {
  readonly strokeColor: string;
  readonly strokeOpacity: number;
  readonly strokeWeight: number;
  readonly fillColor?: string;
  readonly fillOpacity?: number;
  readonly zIndex: number;
}

/**
 * Creates a marker icon configuration
 * @param isHovered - Whether the marker is being hovered over
 * @param classification - Message classification ("active" or "archived")
 * @param customColors - Optional custom color palette (defaults to app colors)
 * @param customOpacity - Optional custom opacity values (defaults to app opacity)
 * @returns Marker icon configuration
 */
export function createMarkerIcon(
  isHovered: boolean = false,
  classification: "active" | "archived" = "active",
  customColors = colors,
  customOpacity = opacity,
): MarkerIconConfig {
  const isArchived = classification === "archived";
  const fillColor = isArchived
    ? customColors.primary.grey
    : customColors.primary.red;
  const baseOpacity = isArchived
    ? customOpacity.archivedDefault
    : customOpacity.default;
  const hoverOpacity = isArchived
    ? customOpacity.archivedHover
    : customOpacity.hover;

  return {
    path: "M 0,0 m -8,0 a 8,8 0 1,0 16,0 a 8,8 0 1,0 -16,0",
    fillColor,
    fillOpacity: isHovered ? hoverOpacity : baseOpacity,
    strokeWeight: 2,
    strokeColor: customColors.map.stroke,
    scale: isHovered ? 1.2 : 1,
  };
}

/**
 * Creates a cluster marker icon configuration
 * @param count - Number of markers in the cluster
 * @param classification - Message classification ("active" or "archived")
 * @param customColors - Optional custom color palette (defaults to app colors)
 * @returns Cluster icon and label configuration
 */
export function createClusterIcon(
  count: number,
  classification: "active" | "archived" = "active",
  customColors = colors,
): { icon: ClusterIconConfig; label: ClusterLabelConfig } {
  // Scale cluster size based on count, with min/max bounds
  const scale = Math.min(15 + count / 2, 25);

  // Use CIRCLE symbol path (enum value is 0)
  const symbolPath =
    typeof google !== "undefined" && google.maps
      ? google.maps.SymbolPath.CIRCLE
      : 0; // CIRCLE enum value

  const isArchived = classification === "archived";
  const fillColor = isArchived
    ? customColors.primary.grey
    : customColors.primary.red;

  const fillOpacity = isArchived ? opacity.archivedDefault : opacity.default;

  return {
    icon: {
      path: symbolPath,
      fillColor,
      fillOpacity,
      strokeColor: customColors.map.stroke,
      strokeWeight: 2,
      scale,
    },
    label: {
      text: String(count),
      color: "white",
      fontSize: "12px",
      fontWeight: "bold",
    },
  };
}

/**
 * Gets geometry style configuration based on type and state
 * @param geometryType - Type of geometry ('LineString' or 'Polygon')
 * @param isHovered - Whether the geometry is being hovered over
 * @param isSelected - Whether the geometry is selected
 * @param classification - Message classification ("active" or "archived")
 * @returns Geometry style configuration
 */
export function getGeometryStyle(
  geometryType: "LineString" | "Polygon",
  isHovered: boolean = false,
  isSelected: boolean = false,
  classification: "active" | "archived" = "active",
): GeometryStyleConfig {
  const useHoverState = isHovered || isSelected;
  const isArchived = classification === "archived";

  if (geometryType === "LineString") {
    if (isArchived) {
      return useHoverState
        ? GEOJSON_STYLES.lineStringArchivedHover
        : GEOJSON_STYLES.lineStringArchived;
    }
    return useHoverState
      ? GEOJSON_STYLES.lineStringHover
      : GEOJSON_STYLES.lineString;
  }

  if (geometryType === "Polygon") {
    if (isArchived) {
      return useHoverState
        ? GEOJSON_STYLES.polygonArchivedHover
        : GEOJSON_STYLES.polygonArchived;
    }
    return useHoverState ? GEOJSON_STYLES.polygonHover : GEOJSON_STYLES.polygon;
  }

  // Default fallback (should not reach here with proper typing)
  return GEOJSON_STYLES.lineString;
}

/**
 * Creates customizable geometry styles
 * @param geometryType - Type of geometry
 * @param options - Style customization options
 * @returns Custom geometry style configuration
 */
export function createCustomGeometryStyle(
  geometryType: "LineString" | "Polygon",
  options: {
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
    fillColor?: string;
    fillOpacity?: number;
    zIndex?: number;
  } = {},
): GeometryStyleConfig {
  const baseStyle = getGeometryStyle(geometryType);

  return {
    ...baseStyle,
    ...options,
  };
}

/**
 * Type definitions for export
 */
export type GeometryType = "LineString" | "Polygon";
