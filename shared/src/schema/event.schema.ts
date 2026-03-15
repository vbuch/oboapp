import { z } from "../zod-openapi";
import { CategoryEnum } from "./category.schema";
import { CadastralPropertySchema } from "./extracted-data.schema";
import { GeoJsonFeatureCollectionSchema } from "./geojson.schema";
import { PinSchema } from "./pin.schema";
import { StreetSectionSchema } from "./street-section.schema";

/**
 * EventSchema — represents a real-world incident aggregated from one or more messages.
 * Used by backend processing and future public APIs.
 *
 * DESIGN PRINCIPLE: Event fields intentionally mirror MessageSchema field names and types
 * (plainText, markdownText, geoJson, categories, timespanStart/End, cityWide, locality,
 * embedding, etc.). This alignment allows the map and public API to switch from exposing
 * messages to exposing events with no schema migration or API contract change.
 * Keep field names consistent with MessageSchema when adding new fields.
 */
export const EventSchema = z.object({
  id: z.string().optional(),
  /**
   * Canonical normalized text for the event. Required on events (unlike MessageSchema
   * where it's optional) because events are always created from processed messages.
   *
   * NOTE: MessageSchema.text is a transient ingestion field (raw crawler/user input)
   * not intended for public display. Events intentionally omit it — plainText is the
   * correct public-facing text field for both messages and events.
   */
  plainText: z.string(),
  markdownText: z.string().nullable().optional(),
  geoJson: GeoJsonFeatureCollectionSchema.nullable().optional(),
  geometryQuality: z.number().int().min(0).max(3),
  timespanStart: z.string().nullable().optional(),
  timespanEnd: z.string().nullable().optional(),
  categories: z.array(CategoryEnum).optional(),
  pins: z.array(PinSchema).optional(),
  streets: z.array(StreetSectionSchema).optional(),
  cadastralProperties: z.array(CadastralPropertySchema).optional(),
  busStops: z.array(z.string()).optional(),
  sources: z.array(z.string()),
  messageCount: z.number().int().min(1),
  confidence: z.number().min(0).max(1),
  locality: z.string(),
  cityWide: z.boolean().optional(),
  embedding: z.array(z.number().finite()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Event = z.infer<typeof EventSchema>;
