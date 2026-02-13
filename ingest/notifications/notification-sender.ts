import type { OboDb } from "@oboapp/db";
import type { Messaging } from "firebase-admin/messaging";
import {
  Message,
  NotificationMatch,
  NotificationSubscription,
  DeviceNotification,
} from "@/lib/types";
import {
  getUserSubscriptions,
  deleteSubscription,
} from "./subscription-manager";
import { logger } from "@/lib/logger";

function toISOString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

// App URL (use env var or fallback for tests)
const APP_URL_ENV = process.env.APP_URL;

if (!APP_URL_ENV && process.env.NODE_ENV === "production") {
  throw new Error("Environment variable APP_URL must be set in production.");
}

const APP_URL = APP_URL_ENV || "http://localhost:3000";
/**
 * Build notification payload for FCM
 */
export function buildNotificationPayload(
  message: Message,
  match: NotificationMatch,
) {
  const messagePreview =
    message.text.length > 100
      ? message.text.substring(0, 100) + "..."
      : message.text;

  const distanceText = match.distance
    ? ` (${Math.round(match.distance)}m от вашия район)`
    : "";

  // Message ID is URL-encoded to handle any special characters
  const messageUrl = `${APP_URL}/m/${encodeURIComponent(match.messageId)}`;

  return {
    data: {
      title: "Ново съобщение в OboApp",
      body: `${messagePreview}${distanceText}`,
      icon: `${APP_URL}/icon-192x192.png`,
      badge: `${APP_URL}/icon-72x72.png`,
      messageId: match.messageId,
      interestId: match.interestId,
      matchId: match.id || "",
      url: messageUrl,
    },
    webpush: {
      fcmOptions: {
        link: messageUrl,
      },
    },
  };
}

/**
 * Send push notification to a single device
 */
export async function sendPushNotification(
  db: OboDb,
  messaging: Messaging,
  subscription: NotificationSubscription,
  message: Message,
  match: NotificationMatch,
): Promise<{ success: boolean; error?: string; tokenInvalid?: boolean }> {
  try {
    const payload = buildNotificationPayload(message, match);

    await messaging.send({
      token: subscription.token,
      ...payload,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as { code?: string })?.code;

    // Check if the FCM token is invalid/expired
    const isInvalidToken =
      errorCode === "messaging/registration-token-not-registered" ||
      errorCode === "messaging/invalid-registration-token";

    if (isInvalidToken && subscription.id) {
      // Token is stale — log as warning (handled gracefully) and remove it
      logger.warn("Stale FCM token detected, removing subscription", {
        errorCode,
        subscriptionId: subscription.id.substring(0, 8),
      });
      await deleteSubscription(db, subscription.id);
    } else {
      // Genuine send failure — log as error
      logger.error("Failed to send notification", {
        error: errorMessage,
        errorCode,
      });
    }

    return {
      success: false,
      error: errorMessage,
      tokenInvalid: isInvalidToken,
    };
  }
}

/**
 * Send notification to all user devices
 */
export async function sendToUserDevices(
  db: OboDb,
  messaging: Messaging,
  userId: string,
  message: Message,
  match: NotificationMatch,
): Promise<{ successCount: number; notifications: DeviceNotification[] }> {
  const subscriptions = await getUserSubscriptions(db, userId);

  if (subscriptions.length === 0) {
    logger.info("No subscriptions for user", {
      userId: userId.substring(0, 8),
    });
    return { successCount: 0, notifications: [] };
  }

  const deviceNotifications: DeviceNotification[] = [];
  let successCount = 0;

  for (const subscription of subscriptions) {
    const result = await sendPushNotification(
      db,
      messaging,
      subscription,
      message,
      match,
    );

    const deviceNotification: DeviceNotification = {
      subscriptionId: subscription.id || "",
      deviceInfo: subscription.deviceInfo,
      sentAt: new Date().toISOString(),
      success: result.success,
    };

    // Only include error field if there was an error (avoid undefined)
    if (result.error) {
      deviceNotification.error = result.error;
    }

    deviceNotifications.push(deviceNotification);

    if (result.success) {
      successCount++;
    }
  }

  return { successCount, notifications: deviceNotifications };
}

/**
 * Update match document with notification results
 */
export async function updateMatchWithResults(
  db: OboDb,
  matchId: string,
  messageData: Record<string, unknown>,
  deviceNotifications: DeviceNotification[],
): Promise<void> {
  const messageSnapshot: Record<string, string> = {
    text: (messageData?.text as string) || "",
    createdAt: toISOString(messageData?.createdAt),
  };

  // Only add optional fields if they exist (avoid undefined in Firestore)
  if (messageData?.source) {
    messageSnapshot.source = messageData.source as string;
  }
  if (messageData?.sourceUrl) {
    messageSnapshot.sourceUrl = messageData.sourceUrl as string;
  }

  await db.notificationMatches.updateOne(matchId, {
    deviceNotifications,
    messageSnapshot,
  });
}

/**
 * Mark matches as notified
 */
export async function markMatchesAsNotified(
  db: OboDb,
  matchIds: string[],
): Promise<void> {
  logger.info("Marking matches as notified", { count: matchIds.length });

  const now = new Date();

  for (const matchId of matchIds) {
    await db.notificationMatches.updateOne(matchId, {
      notified: true,
      notifiedAt: now,
    });
  }
}
