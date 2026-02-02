import { z } from "zod";
import { AddressSchema } from "./address.schema";
import { ExtractedDataSchema } from "./extracted-data.schema";
import { GeoJsonFeatureCollectionSchema } from "./geojson.schema";
import { IngestErrorSchema } from "./ingest-error.schema";

export const MessageSchema = z.object({
  id: z.string().optional(),
  text: z.string(),
  addresses: z.array(AddressSchema).optional(),
  extractedData: ExtractedDataSchema.optional(),
  geoJson: GeoJsonFeatureCollectionSchema.optional(),
  ingestErrors: z.array(IngestErrorSchema).optional(),
  createdAt: z.string(),
  crawledAt: z.string().optional(),
  finalizedAt: z.string().optional(),
  source: z.string().optional(),
  sourceUrl: z.string().optional(),
  sourceDocumentId: z.string().optional(),
  markdownText: z.string().optional(),
  categories: z.array(z.string()).optional(),
  relations: z.array(z.string()).optional(),
  isRelevant: z.boolean().optional(),
  timespanStart: z.string().optional(),
  timespanEnd: z.string().optional(),
  cityWide: z.boolean().optional(),
});

export type Message = z.infer<typeof MessageSchema>;
