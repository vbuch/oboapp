import { z } from "zod";
import dotenv from "dotenv";
import { resolve } from "node:path";

import { buildGeocodingResolvers } from "@oboapp/shared";

// Load environment variables at module load time
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const LocalityDataSourcesSchema = z.object({
  "geocoding-resolvers": z.object({
    pins: z
      .array(
        z.discriminatedUnion("provider", [
          z.object({ provider: z.literal("google") }),
          z.object({ provider: z.literal("overpass") }),
        ]),
      )
      .min(1),
    streets: z
      .array(
        z.discriminatedUnion("provider", [
          z.object({ provider: z.literal("overpass") }),
          z.object({ provider: z.literal("google") }),
        ]),
      )
      .min(1),
    "cadastral-properties": z
      .array(
        z.discriminatedUnion("provider", [
          z.object({ provider: z.literal("cadastre") }),
          z.object({ provider: z.literal("skip") }),
        ]),
      )
      .min(1),
    "bus-stops": z
      .array(
        z.discriminatedUnion("provider", [
          z.object({
            provider: z.literal("gtfs"),
            url: z.string().pipe(z.url()),
          }),
          z.object({ provider: z.literal("google") }),
          z.object({ provider: z.literal("overpass") }),
          z.object({ provider: z.literal("skip") }),
        ]),
      )
      .min(1),
    "educational-facilities": z
      .array(
        z.discriminatedUnion("provider", [
          z.object({
            provider: z.literal("educational-facilities"),
            "schools-url": z.string().pipe(z.url()),
            "kindergartens-url": z.string().pipe(z.url()),
          }),
          z.object({ provider: z.literal("google") }),
          z.object({ provider: z.literal("skip") }),
        ]),
      )
      .min(1),
  }),
});

export type LocalityDataSources = z.infer<typeof LocalityDataSourcesSchema>;

export type GeocodingResolvers = LocalityDataSources["geocoding-resolvers"];

let cachedSources: LocalityDataSources | null = null;

function loadLocalityDataSources(): LocalityDataSources {
  // Load geocoding resolver config from shared and populate URLs from environment
  const resolvers = buildGeocodingResolvers();

  // Populate environment-specific URLs
  const busResolvers = Array.isArray(resolvers["bus-stops"])
    ? resolvers["bus-stops"]
    : [];
  for (const resolver of busResolvers) {
    if (resolver.provider === "gtfs") {
      resolver.url ||= process.env.GTFS_URL || "";
    }
  }

  const educationalResolvers = Array.isArray(
    resolvers["educational-facilities"],
  )
    ? resolvers["educational-facilities"]
    : [];
  for (const resolver of educationalResolvers) {
    if (resolver.provider === "educational-facilities") {
      resolver["schools-url"] ||= process.env.SCHOOLS_URL || "";
      resolver["kindergartens-url"] ||= process.env.KINDERGARTENS_URL || "";
    }
  }

  const result = LocalityDataSourcesSchema.safeParse({
    "geocoding-resolvers": resolvers,
  });
  if (!result.success) {
    throw new Error(
      `Invalid GEOCODING_RESOLVERS export from @oboapp/shared: ${result.error.message}`,
    );
  }

  return result.data;
}

/**
 * Returns the locality data sources config for the current locality.
 * Throws if the file is absent or the schema is invalid — fail-fast at startup.
 */
export function getLocalityDataSources(): LocalityDataSources {
  cachedSources ??= loadLocalityDataSources();
  return cachedSources;
}
