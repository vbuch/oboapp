import { z } from "../zod-openapi";
import { PinSchema } from "./pin.schema";
import { StreetSectionSchema } from "./street-section.schema";

export const CadastralPropertySchema = z.object({
  identifier: z.string(),
  timespans: z.array(
    z.object({
      start: z.string(),
      end: z.string(),
    }),
  ),
});

export const ExtractedLocationsSchema = z.object({
  withSpecificAddress: z.boolean().optional(),
  busStops: z.array(z.string()).optional(),
  cityWide: z.boolean().optional(),
  pins: z.array(PinSchema),
  streets: z.array(StreetSectionSchema),
  cadastralProperties: z.array(CadastralPropertySchema).optional(),
});

export type CadastralProperty = z.infer<typeof CadastralPropertySchema>;
export type ExtractedLocations = z.infer<typeof ExtractedLocationsSchema>;

// Legacy aliases for backward compatibility with existing imports
export const ExtractedDataSchema = ExtractedLocationsSchema;
export type ExtractedData = ExtractedLocations;
