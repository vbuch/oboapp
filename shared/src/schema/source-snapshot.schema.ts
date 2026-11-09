import { z } from "../zod-openapi";

export const SourceSnapshotSchema = z.object({
  sourceType: z.string().min(1),
  locality: z.string().min(1),
  count: z.number().int().nonnegative(),
  observedAt: z.iso.datetime(),
});

export type SourceSnapshot = z.infer<typeof SourceSnapshotSchema>;
