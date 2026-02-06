import type { Firestore } from "firebase-admin/firestore";
import { Message } from "@/lib/types";
import { convertTimestamp } from "./utils";
import { logger } from "@/lib/logger";

/**
 * Get all unprocessed messages (messages without notificationsSent flag)
 */
export async function getUnprocessedMessages(
  adminDb: Firestore,
): Promise<Message[]> {
  logger.info("Fetching unprocessed messages");

  const messagesRef = adminDb.collection("messages");

  // Get all messages ordered by createdAt
  const messagesSnapshot = await messagesRef.orderBy("createdAt", "asc").get();

  // Filter for messages that don't have notificationsSent or where it's false
  const unprocessedMessages: Message[] = [];
  messagesSnapshot.forEach((doc) => {
    const data = doc.data();
    // Only include messages where notificationsSent is not true
    if (data.notificationsSent !== true) {
      unprocessedMessages.push({
        id: doc.id,
        text: data.text,
        geoJson: data.geoJson ? JSON.parse(data.geoJson) : undefined,
        createdAt: convertTimestamp(data.createdAt),
        cityWide: data.cityWide,
      });
    }
  });

  logger.info("Found unprocessed messages", { count: unprocessedMessages.length });

  return unprocessedMessages;
}

/**
 * Mark messages as having notifications sent
 */
export async function markMessagesAsNotified(
  adminDb: Firestore,
  messageIds: string[],
): Promise<void> {
  logger.info("Marking messages as notified", { count: messageIds.length });

  const messagesRef = adminDb.collection("messages");
  const now = new Date();

  for (const messageId of messageIds) {
    await messagesRef.doc(messageId).update({
      notificationsSent: true,
      notificationsSentAt: now,
    });
  }

  logger.info("Marked messages as notified", { count: messageIds.length });
}
