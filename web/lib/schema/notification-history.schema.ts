import { z } from "@/lib/schema/zod-openapi";
import { MessageSnapshotSchema } from "@/lib/schema/message-snapshot.schema";

export const NotificationHistoryItemSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  messageSnapshot: MessageSnapshotSchema,
  notifiedAt: z.string(),
  distance: z.number().optional(),
  interestId: z.string(),
  successfulDevicesCount: z.number(),
});

export type NotificationHistoryItem = z.infer<
  typeof NotificationHistoryItemSchema
>;
