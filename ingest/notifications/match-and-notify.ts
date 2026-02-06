#!/usr/bin/env node

import dotenv from "dotenv";
import { resolve } from "node:path";
import type { Firestore } from "firebase-admin/firestore";
import type { Messaging } from "firebase-admin/messaging";
import { Message, NotificationMatch } from "@/lib/types";
import {
  getUnprocessedMessages,
  markMessagesAsNotified,
} from "./message-fetcher";
import { getAllInterests } from "./interest-fetcher";
import {
  matchMessagesWithInterests,
  deduplicateMatches,
  storeNotificationMatches,
  getUnnotifiedMatches,
} from "./match-processor";
import {
  sendToUserDevices,
  updateMatchWithResults,
  markMatchesAsNotified,
} from "./notification-sender";
import { convertTimestamp } from "./utils";
import { logger } from "@/lib/logger";

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

/**
 * Send notifications for matches
 */
async function sendNotifications(
  adminDb: Firestore,
  messaging: Messaging,
  matches: NotificationMatch[],
): Promise<void> {
  logger.info("Sending notifications");

  const messagesRef = adminDb.collection("messages");

  let successCount = 0;
  let errorCount = 0;

  // Group matches by userId-messageId to send only one notification per user per message
  const notificationMap = new Map<string, NotificationMatch>();
  for (const match of matches) {
    const key = `${match.userId}-${match.messageId}`;
    const existing = notificationMap.get(key);
    // Keep the match with the smallest distance
    if (
      !existing ||
      (match.distance &&
        (!existing.distance || match.distance < existing.distance))
    ) {
      notificationMap.set(key, match);
    }
  }

  const uniqueMatches = Array.from(notificationMap.values());
  logger.info("Sending unique notifications", {
    unique: uniqueMatches.length,
    total: matches.length,
  });

  // Track which matches were processed to mark them all as notified
  const allMatchIds = matches
    .map((m) => m.id)
    .filter((id): id is string => !!id);

  for (const match of uniqueMatches) {
    if (!match.id) {
      continue;
    }

    // Get message details
    const messageDoc = await messagesRef.doc(match.messageId).get();
    if (!messageDoc.exists) {
      logger.warn("Message not found for notification", { messageId: match.messageId });
      continue;
    }

    const messageData = messageDoc.data();
    const message: Message = {
      id: messageDoc.id,
      text: messageData?.text || "",
      geoJson: messageData?.geoJson
        ? JSON.parse(messageData.geoJson)
        : undefined,
      createdAt: convertTimestamp(messageData?.createdAt),
    };

    // Send to all user devices
    const { successCount: deviceSuccessCount, notifications } =
      await sendToUserDevices(adminDb, messaging, match.userId, message, match);

    if (deviceSuccessCount > 0) {
      successCount++;
      logger.info("Notification sent", {
        userId: match.userId.substring(0, 8),
        devicesSuccess: deviceSuccessCount,
        devicesTotal: notifications.length,
        messageId: match.messageId.substring(0, 8),
      });
    } else {
      errorCount++;
      logger.error("Failed to send to any device", {
        userId: match.userId.substring(0, 8),
        messageId: match.messageId.substring(0, 8),
      });
    }

    // Update match document with results
    if (messageData) {
      await updateMatchWithResults(
        adminDb,
        match.id,
        messageData,
        notifications,
      );
    }
  }

  // Mark all related matches as notified
  await markMatchesAsNotified(adminDb, allMatchIds);

  logger.info("Notification sending complete", { successCount, errorCount });
}

/**
 * Initialize Firebase Admin
 */
async function initFirebase(): Promise<{
  adminDb: Firestore;
  messaging: Messaging;
}> {
  const firebaseAdmin = await import("@/lib/firebase-admin");
  const { getMessaging } = await import("firebase-admin/messaging");

  return {
    adminDb: firebaseAdmin.adminDb,
    messaging: getMessaging(firebaseAdmin.adminApp),
  };
}

/**
 * Main function
 */
export async function main(): Promise<void> {
  logger.info("Starting notification matching and sending");

  const { adminDb, messaging } = await initFirebase();

  // Step 1: Get unprocessed messages (messages without notificationsSent flag)
  const unprocessedMessages = await getUnprocessedMessages(adminDb);

  if (unprocessedMessages.length === 0) {
    logger.info("No new messages to process");
    return;
  }

  // Step 2: Get all user interests
  const interests = await getAllInterests(adminDb);

  if (interests.length === 0) {
    logger.info("No user interests configured");
    // Still mark messages as processed so we don't reprocess them
    const messageIds = unprocessedMessages
      .map((m) => m.id)
      .filter((id): id is string => !!id);
    await markMessagesAsNotified(adminDb, messageIds);
    return;
  }

  // Step 3: Match messages with interests
  const matches = await matchMessagesWithInterests(
    unprocessedMessages,
    interests,
  );

  if (matches.length === 0) {
    logger.info("No matches found");
    // Still mark messages as processed
    const messageIds = unprocessedMessages
      .map((m) => m.id)
      .filter((id): id is string => !!id);
    await markMessagesAsNotified(adminDb, messageIds);
    return;
  }

  // Step 4: Deduplicate matches
  const dedupedMatches = deduplicateMatches(matches);

  // Step 5: Store matches in Firestore
  await storeNotificationMatches(adminDb, dedupedMatches);

  // Step 6: Get all unnotified matches (including ones we just stored)
  const unnotifiedMatches = await getUnnotifiedMatches(adminDb);

  if (unnotifiedMatches.length === 0) {
    logger.info("No unnotified matches to send");
    // Mark messages as processed
    const messageIds = unprocessedMessages
      .map((m) => m.id)
      .filter((id): id is string => !!id);
    await markMessagesAsNotified(adminDb, messageIds);
    return;
  }

  // Step 7: Send notifications
  await sendNotifications(adminDb, messaging, unnotifiedMatches);

  // Step 8: Mark messages as having notifications sent
  const messageIds = unprocessedMessages
    .map((m) => m.id)
    .filter((id): id is string => !!id);
  await markMessagesAsNotified(adminDb, messageIds);

  logger.info("Notification processing complete");
}

// Run the script only when executed directly
if (require.main === module) {
  void (async () => {
    try {
      await main();
    } catch (error) {
      logger.error("Fatal error in notification processing", { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    }
  })();
}
