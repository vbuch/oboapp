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

export const SourceIncidentChangesResponseSchema = z.object({
  sourceType: z.string().min(1),
  locality: z.string().min(1),
  sourceUrl: z.url(),
  date: z.iso.date(),
  baselineDate: z.iso.date(),
  baseline: SourceCountObservationSchema.nullable(),
  end: SourceCountObservationSchema.nullable(),
  netChange: z.number().int().nullable(),
  totals: z.object({
    added: z.number().int().nonnegative(),
    removed: z.number().int().nonnegative(),
  }).nullable(),
  coverage: z.object({
    status: z.enum(["observed", "unavailable"]),
    reasons: z.array(z.enum([
      "missing_baseline",
      "missing_end",
      "missing_incident_details",
      "capture_limit_exceeded",
      "missing_history",
    ])),
    retainedCaptureCount: z.number().int().nonnegative(),
    detailedCaptureCount: z.number().int().nonnegative(),
    gapThresholdMinutes: z.number().positive(),
    gaps: z.array(z.object({
      fromObservedAt: z.iso.datetime(),
      toObservedAt: z.iso.datetime(),
      minutes: z.number().positive(),
    })),
    failedChecks: z.literal("not_recorded"),
    continuity: z.literal("unknown"),
    latestObservedAt: z.iso.datetime().nullable(),
    stale: z.boolean().nullable(),
    staleAfterMinutes: z.number().positive(),
  }),
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
export type SourceIncidentChangesResponse = z.infer<typeof SourceIncidentChangesResponseSchema>;
export type MessagesResponse = z.infer<typeof MessagesResponseSchema>;
export type MessageResponse = z.infer<typeof MessageResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
