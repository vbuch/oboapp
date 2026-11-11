import { z } from "../lib/zod-openapi";
import { MessageSchema, SourceSchema, SourceSnapshotSchema } from "./contract";
import {
  SourceIncidentSchema,
  SourceSnapshotSchema as StoredSourceSnapshotSchema,
} from "@oboapp/shared";

export const SourcesResponseSchema = z.object({
  sources: z.array(SourceSchema),
});

export const SourceSnapshotResponseSchema = z.object({
  snapshot: SourceSnapshotSchema,
});

const SourceCountObservationSchema = z.object({
  count: z.number().int().nonnegative(),
  observedAt: z.iso.datetime(),
});

export const SourceTimelineResponseSchema = z.object({
  sourceType: z.string().min(1),
  locality: z.string().min(1),
  sourceUrl: z.url(),
  current: SourceCountObservationSchema.nullable(),
  daily: z.array(SourceCountObservationSchema.extend({ date: z.iso.date() })),
  comparison: SourceCountObservationSchema.extend({
    date: z.iso.date(),
    change: z.number().int(),
  }).nullable(),
});

export const SourceIncidentsResponseSchema = StoredSourceSnapshotSchema.safeExtend({
  sourceUrl: z.url(),
  incidents: z.array(SourceIncidentSchema.extend({
    firstObservedAt: z.iso.datetime().nullable(),
    firstReportedStart: z.iso.datetime().nullable(),
    firstEstimatedEnd: z.iso.datetime().nullable(),
  })),
});

export const MessagesResponseSchema = z.object({
  messages: z.array(MessageSchema),
});

export const MessageResponseSchema = z.object({
  message: MessageSchema,
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
});

export type SourcesResponse = z.infer<typeof SourcesResponseSchema>;
export type SourceSnapshotResponse = z.infer<typeof SourceSnapshotResponseSchema>;
export type SourceTimelineResponse = z.infer<typeof SourceTimelineResponseSchema>;
export type SourceIncidentsResponse = z.infer<typeof SourceIncidentsResponseSchema>;
export type MessagesResponse = z.infer<typeof MessagesResponseSchema>;
export type MessageResponse = z.infer<typeof MessageResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
