/** Matching threshold — score above this means "same event" */
export const MATCH_THRESHOLD = 0.7;

/** Time window for candidate search (days before/after message timespan) */
export const CANDIDATE_TIME_WINDOW_DAYS = 2;

/** Maximum distance in meters for location similarity consideration */
export const CANDIDATE_DISTANCE_METERS = 500;

/** Weight for location similarity in composite score */
export const LOCATION_WEIGHT = 0.5;

/** Weight for temporal overlap in composite score */
export const TIME_WEIGHT = 0.35;

/** Weight for category match in composite score */
export const CATEGORY_WEIGHT = 0.15;

/** Pre-geocode matching: higher threshold (no spatial comparison) */
export const PRE_GEOCODE_MATCH_THRESHOLD = 0.8;

/** Minimum geometry quality on an event to reuse its geometry (skip geocoding) */
export const MIN_REUSABLE_GEOMETRY_QUALITY = 2;

/** Pre-geocode scoring weights (time + category only, no location) */
export const PRE_GEOCODE_TIME_WEIGHT = 0.7;
export const PRE_GEOCODE_CATEGORY_WEIGHT = 0.3;
