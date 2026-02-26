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
    /** Grey for archived markers and messages */
    grey: "#6B7280",
    /** Darker grey for hover states on archived markers */
    greyDark: "#4B5563",
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

  // Semantic UI colors for consistent theming
  semantic: {
    // Neutral colors (for borders, backgrounds, disabled states)
    /** Neutral text and icon color - gray-500 equivalent */
    neutral: "#6B7280",
    /** Light neutral background - gray-100 equivalent */
    neutralLight: "#F3F4F6",
    /** Neutral border color - gray-200 equivalent */
    neutralBorder: "#E5E7EB",

    // Error colors (for destructive warnings, validation errors)
    /** Error text and icon color - red-600 equivalent */
    error: "#DC2626",
    /** Light error background - red-50 equivalent */
    errorLight: "#FEE2E2",
    /** Error border color - red-200 equivalent */
    errorBorder: "#FECACA",

    // Warning colors (for alerts, caution messages)
    /** Warning text and icon color - amber-500 equivalent */
    warning: "#F59E0B",
    /** Light warning background - amber-50 equivalent */
    warningLight: "#FEF3C7",
    /** Warning border color - amber-200 equivalent */
    warningBorder: "#FDE68A",

    // Success colors (for confirmations, completed states)
    /** Success text and icon color - green-500 equivalent */
    success: "#10B981",
    /** Light success background - green-50 equivalent */
    successLight: "#D1FAE5",
    /** Success border color - green-200 equivalent */
    successBorder: "#A7F3D0",

    // Info colors (for informational messages)
    /** Info text and icon color - blue-500 equivalent */
    info: "#3B82F6",
    /** Light info background - blue-50 equivalent */
    infoLight: "#DBEAFE",
    /** Info border color - blue-200 equivalent */
    infoBorder: "#BFDBFE",
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
  /** Default opacity for archived messages (more transparent) */
  archivedDefault: 0.6,
  /** Hover opacity for archived messages */
  archivedHover: 0.8,
  /** Fill opacity for archived polygons */
  archivedFill: 0.15,
  /** Fill opacity for archived polygons on hover */
  archivedFillHover: 0.25,
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
 * Z-index scale for consistent stacking context
 * Use these values to ensure proper layering of UI elements
 */
export const zIndex = {
  /** Base content - map, messages, page content */
  base: "z-0",
  /** Fixed UI elements - geolocation button, onboarding buttons */
  fixed: "z-10",
  /** Navigation and top loading indicators */
  nav: "z-20",
  /** Overlays - slide-out panels, dropdowns */
  overlay: "z-30",
  /** Overlay content - panel content that should be above overlay backdrops */
  overlayContent: "z-40",
  /** Modal backdrops - full-screen overlays for modals and prompts */
  modalBackdrop: "z-50",
  /** Modal content - dialogs, prompts that appear above modal backdrops */
  modalContent: "z-60",
} as const;

/**
 * Type-safe color access
 */
export type ColorPalette = typeof colors;
export type OpacityValues = typeof opacity;
export type BorderRadiusValues = typeof borderRadius;
export type ZIndexValues = typeof zIndex;
