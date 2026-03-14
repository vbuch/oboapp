import { z } from "../zod-openapi";
import { CategoryEnum } from "./category.schema";
import { GeoJsonFeatureCollectionSchema } from "./geojson.schema";

/**
 * EventSchema — represents a real-world incident aggregated from one or more messages.
 * Used by backend processing and future public APIs.
 */
export const EventSchema = z.object({
  id: z.string().optional(),
  canonicalText: z.string(),
  canonicalMarkdownText: z.string().nullable().optional(),
  geometry: GeoJsonFeatureCollectionSchema.nullable().optional(),
  geometryQuality: z.number().int().min(0).max(3),
  timespanStart: z.string().nullable().optional(),
  timespanEnd: z.string().nullable().optional(),
  categories: z.array(CategoryEnum).optional(),
  sources: z.array(z.string()),
  messageCount: z.number().int().min(1),
  confidence: z.number().min(0).max(1),
  locality: z.string(),
  cityWide: z.boolean().optional(),
  embedding: z.array(z.number()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Event = z.infer<typeof EventSchema>;
