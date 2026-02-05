import { z } from "../zod-openapi";

export const MessageSnapshotSchema = z.object({
  text: z.string(),
  createdAt: z.string(),
  source: z.string().optional(),
  sourceUrl: z.string().optional(),
});

export type MessageSnapshot = z.infer<typeof MessageSnapshotSchema>;
