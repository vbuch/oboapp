import { z } from "zod";
import dotenv from "dotenv";
import { resolve } from "node:path";

import { buildGeocodingResolvers } from "@oboapp/shared";

// Load environment variables at module load time
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const LocalityDataSourcesSchema = z.object({
  "geocoding-resolvers": z.object({
    pins: z.discriminatedUnion("provider", [
      z.object({ provider: z.literal("google") }),
      z.object({ provider: z.literal("overpass") }),
    ]),
    streets: z.discriminatedUnion("provider", [
      z.object({ provider: z.literal("overpass") }),
      z.object({ provider: z.literal("google") }),
    ]),
    "cadastral-properties": z.discriminatedUnion("provider", [
      z.object({ provider: z.literal("cadastre") }),
      z.object({ provider: z.literal("skip") }),
    ]),
    "bus-stops": z.discriminatedUnion("provider", [
      z.object({ provider: z.literal("gtfs"), url: z.string() }),
      z.object({ provider: z.literal("google") }),
      z.object({ provider: z.literal("overpass") }),
      z.object({ provider: z.literal("skip") }),
    ]),
    "educational-facilities": z.discriminatedUnion("provider", [
      z.object({
        provider: z.literal("educational-facilities"),
        "schools-url": z.string(),
        "kindergartens-url": z.string(),
      }),
      z.object({ provider: z.literal("google") }),
      z.object({ provider: z.literal("skip") }),
    ]),
  }),
});

export type LocalityDataSources = z.infer<typeof LocalityDataSourcesSchema>;

export type GeocodingResolvers = LocalityDataSources["geocoding-resolvers"];

let cachedSources: LocalityDataSources | null = null;

function loadLocalityDataSources(): LocalityDataSources {
  // Load geocoding resolver config from shared and populate URLs from environment
  const resolvers = buildGeocodingResolvers();
  
  // Populate environment-specific URLs
  for (const resolver of resolvers["bus-stops"]) {
    if (resolver.provider === "gtfs") {
      resolver.url ||= process.env.GTFS_URL || "";
    }
  }
  
  for (const resolver of resolvers["educational-facilities"]) {
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
      `Invalid geocoding resolvers configuration: ${result.error.message}`,
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
