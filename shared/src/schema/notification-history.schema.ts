import { z } from "../zod-openapi";
import { MessageSnapshotSchema } from "./message-snapshot.schema";

export const NotificationHistoryItemSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  messageSnapshot: MessageSnapshotSchema,
  notifiedAt: z.string(),
  distance: z.number().optional(),
  interestId: z.string(),
  successfulDevicesCount: z.number(),
  readAt: z.string().optional(),
});

export type NotificationHistoryItem = z.infer<
  typeof NotificationHistoryItemSchema
>;
