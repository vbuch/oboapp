/**
 * Color palette for OboApp
 * Centralized color definitions used across the application
 */

export const colors = {
  // Brand colors
  primary: {
    /** Main brand red - used for logo, markers, and primary actions */
    red: "#E74C3C",
    /** Darker red for hover states */
    redDark: "#C0392B",
    /** Light blue for navigation and links */
    blue: "#5DADE2",
    /** Dark blue for header background */
    blueDark: "#2c3e50",
  },

  // Interaction colors
  interaction: {
    /** Circle color for interest zones */
    circle: "#1976D2",
  },

  // Map layer colors
  map: {
    /** Stroke color for map overlays */
    stroke: "#ffffff",
  },

  // UI colors
  ui: {
    /** Background color - light gray */
    background: "#ffffff",
    /** Foreground/text color - dark gray */
    foreground: "#171717",
    /** Footer background - very light gray */
    footerBg: "#f8f9fa",
  },
} as const;

/**
 * Opacity values for consistent transparency
 */
export const opacity = {
  /** Default opacity for GeoJSON features */
  default: 0.8,
  /** Hover opacity for GeoJSON features */
  hover: 1,
  /** Fill opacity for polygons */
  fill: 0.2,
  /** Fill opacity for polygons on hover */
  fillHover: 0.35,
} as const;

/**
 * Border radius values for consistent component rounding
 */
export const borderRadius = {
  /** Small radius for compact elements */
  sm: "rounded-md",
  /** Medium radius for buttons and cards */
  md: "rounded-lg",
  /** Large radius for prominent containers */
  lg: "rounded-xl",
  /** Full circle for icon buttons and avatars */
  full: "rounded-full",
} as const;

/**
 * Type-safe color access
 */
export type ColorPalette = typeof colors;
export type OpacityValues = typeof opacity;
export type BorderRadiusValues = typeof borderRadius;
