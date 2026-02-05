import { z } from "../zod-openapi";
import { AddressSchema } from "./address.schema";
import { CategoryEnum } from "./category.schema";
import { ExtractedDataSchema } from "./extracted-data.schema";
import { GeoJsonFeatureCollectionSchema } from "./geojson.schema";
import { IngestErrorSchema } from "./ingest-error.schema";
import { PinSchema } from "./pin.schema";
import { StreetSectionSchema } from "./street-section.schema";
import { CadastralPropertySchema } from "./extracted-data.schema";

/**
 * Public MessageSchema - exposes only validated, controlled fields
 * Used by public APIs (YSM API) and frontend components
 */
export const MessageSchema = z.object({
  id: z.string().optional(),
  text: z.string(),
  addresses: z.array(AddressSchema).optional(),
  geoJson: GeoJsonFeatureCollectionSchema.optional(),
  crawledAt: z.string().optional(),
  createdAt: z.string(),
  finalizedAt: z.string().optional(),
  source: z.string().optional(),
  sourceUrl: z.string().optional(),
  markdownText: z.string().optional(),
  categories: z.array(CategoryEnum).optional(),
  timespanStart: z.string().optional(),
  timespanEnd: z.string().optional(),
  cityWide: z.boolean().optional(),
  // Denormalized fields from extractedData/categorize for controlled public exposure
  responsibleEntity: z.string().optional(),
  pins: z.array(PinSchema).optional(),
  streets: z.array(StreetSectionSchema).optional(),
  cadastralProperties: z.array(CadastralPropertySchema).optional(),
  busStops: z.array(z.string()).optional(),
});

export type Message = z.infer<typeof MessageSchema>;

/**
 * InternalMessageSchema - extends MessageSchema with internal-only fields
 * Used by backend processing pipeline and admin features
 */
export const InternalMessageSchema = MessageSchema.extend({
  extractedData: ExtractedDataSchema.optional(),
  categorize: z.any().optional(), // Stringified CategorizedMessage (stored as JSON string)
  ingestErrors: z.array(IngestErrorSchema).optional(),
  sourceDocumentId: z.string().optional(),
  isRelevant: z.boolean().optional(),
  relations: z.array(z.string()).optional(),
});

export type InternalMessage = z.infer<typeof InternalMessageSchema>;
