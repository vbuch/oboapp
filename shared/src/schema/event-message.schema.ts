import { z } from "../zod-openapi";

/** Breakdown of individual matching signals used to compute confidence. */
export const MatchSignalsSchema = z.object({
  locationSimilarity: z.number().min(0).max(1).optional(),
  timeOverlap: z.number().min(0).max(1).optional(),
  categoryMatch: z.number().min(0).max(1).optional(),
  textSimilarity: z.number().min(0).max(1).optional(),
});

export type MatchSignals = z.infer<typeof MatchSignalsSchema>;

/**
 * EventMessageSchema — links a message to an event with matching metadata.
 */
export const EventMessageSchema = z.object({
  id: z.string().optional(),
  eventId: z.string(),
  messageId: z.string(),
  source: z.string(),
  confidence: z.number().min(0).max(1),
  geometryQuality: z.number().int().min(0).max(3),
  matchSignals: MatchSignalsSchema.optional(),
  createdAt: z.string(),
});

export type EventMessage = z.infer<typeof EventMessageSchema>;
