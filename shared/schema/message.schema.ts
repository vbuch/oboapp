import { z } from "zod";
import { AddressSchema } from "./address.schema";
import { ExtractedDataSchema } from "./extracted-data.schema";
import { GeoJsonFeatureCollectionSchema } from "./geojson.schema";

export const MessageSchema = z.object({
  id: z.string(),
  text: z.string(),
  addresses: z.array(AddressSchema),
  extractedData: ExtractedDataSchema.optional(),
  geoJson: GeoJsonFeatureCollectionSchema,
  createdAt: z.string(),
  crawledAt: z.string().optional(),
  finalizedAt: z.string().optional(),
  source: z.string().optional(),
  sourceUrl: z.string().optional(),
  categories: z.array(z.string()),
  timespanStart: z.string().optional(),
  timespanEnd: z.string().optional(),
});

export type Message = z.infer<typeof MessageSchema>;
