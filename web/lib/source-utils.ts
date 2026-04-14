import sources from "@/lib/sources";

/** Mutable source type derived from the web-facing sources module (avoids readonly field incompatibilities). */
export type Source = (typeof sources)[number];

const isHierarchicalLocality = (value: string): boolean =>
  value.includes(".");

const isLocalityMatch = (sourceLocality: string, locality: string): boolean => {
  // Support hierarchical locality IDs, e.g. source "bg.sofia.oborishte"
  // should match instance locality "bg.sofia".
  if (sourceLocality === locality) {
    return true;
  }

  // Guard against overly broad/invalid locality values (e.g. "bg")
  // to avoid unexpectedly matching all nested localities.
  if (!isHierarchicalLocality(locality) || !isHierarchicalLocality(sourceLocality)) {
    return false;
  }

  return sourceLocality.startsWith(`${locality}.`);
};

/**
 * Get sources applicable to a specific locality.
 * Matches exact locality IDs and nested sub-localities.
 * Example: querying "bg.sofia" includes sources with locality
 * "bg.sofia" and "bg.sofia.oborishte".
 * @param locality - The base locality ID (e.g., "bg.sofia")
 * @returns Array of sources that serve this locality or its sub-localities
 */
export function getSourcesForLocality(locality: string): Source[] {
  return sources.filter((source) =>
    source.localities.some((sourceLocality) =>
      isLocalityMatch(sourceLocality, locality),
    ),
  );
}

/**
 * Get sources applicable to the current locality from environment
 * @returns Array of sources for the current NEXT_PUBLIC_LOCALITY
 * @throws Error if NEXT_PUBLIC_LOCALITY is not set
 */
export function getCurrentLocalitySources(): Source[] {
  const locality = process.env.NEXT_PUBLIC_LOCALITY;
  if (!locality) {
    throw new Error(
      "NEXT_PUBLIC_LOCALITY environment variable is required but not set",
    );
  }
  return getSourcesForLocality(locality);
}

/**
 * Get experimental sources for the current locality.
 * Returns sources whose `experimental` flag is true.
 */
export function getExperimentalSources(): Source[] {
  return getCurrentLocalitySources().filter((s) => s.experimental);
}
