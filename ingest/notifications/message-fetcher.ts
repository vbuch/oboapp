import type { OboDb } from "@oboapp/db";
import { Message } from "@/lib/types";
import { logger } from "@/lib/logger";

function toISOString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

/**
 * Get all unprocessed messages (messages without notificationsSent flag)
 */
export async function getUnprocessedMessages(
  db: OboDb,
): Promise<Message[]> {
  logger.info("Fetching unprocessed messages");

  const docs = await db.messages.findMany({
    orderBy: [{ field: "createdAt", direction: "asc" }],
  });

  // Filter for messages that don't have notificationsSent or where it's false
  const unprocessedMessages: Message[] = [];
  for (const data of docs) {
    if (data.notificationsSent !== true) {
      unprocessedMessages.push({
        id: data._id as string,
        text: (data.text as string) || "",
        locality: data.locality as string,
        geoJson: data.geoJson as Message["geoJson"],
        createdAt: toISOString(data.createdAt),
        cityWide: data.cityWide as boolean | undefined,
      });
    }
  }

  logger.info("Found unprocessed messages", { count: unprocessedMessages.length });

  return unprocessedMessages;
}

/**
 * Mark messages as having notifications sent
 */
export async function markMessagesAsNotified(
  db: OboDb,
  messageIds: string[],
): Promise<void> {
  logger.info("Marking messages as notified", { count: messageIds.length });

  const now = new Date();

  for (const messageId of messageIds) {
    await db.messages.updateOne(messageId, {
      notificationsSent: true,
      notificationsSentAt: now,
    });
  }

  logger.info("Marked messages as notified", { count: messageIds.length });
}
