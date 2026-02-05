import type { Firestore } from "firebase-admin/firestore";
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
import { convertTimestamp } from "./utils";

// App URL (use env var or fallback for tests)
const APP_URL_ENV = process.env.NEXT_PUBLIC_APP_URL;

if (!APP_URL_ENV && process.env.NODE_ENV === "production") {
  throw new Error(
    "Environment variable NEXT_PUBLIC_APP_URL must be set in production.",
  );
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

  return {
    data: {
      title: "Ново съобщение в OboApp",
      body: `${messagePreview}${distanceText}`,
      icon: `${APP_URL}/icon-192x192.png`,
      badge: `${APP_URL}/icon-72x72.png`,
      messageId: match.messageId,
      interestId: match.interestId,
      matchId: match.id || "",
      url: `${APP_URL}/?messageId=${match.messageId}`,
    },
    webpush: {
      fcmOptions: {
        link: `${APP_URL}/?messageId=${match.messageId}`,
      },
    },
  };
}

/**
 * Send push notification to a single device
 */
export async function sendPushNotification(
  adminDb: Firestore,
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
    console.error(`   ❌ Failed to send notification:`, error);

    // Check if the FCM token is invalid/expired
    const errorCode = (error as { code?: string })?.code;
    const isInvalidToken =
      errorCode === "messaging/registration-token-not-registered" ||
      errorCode === "messaging/invalid-registration-token";

    if (isInvalidToken && subscription.id) {
      // Delete the stale subscription to prevent future failures
      await deleteSubscription(adminDb, subscription.id);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      tokenInvalid: isInvalidToken,
    };
  }
}

/**
 * Send notification to all user devices
 */
export async function sendToUserDevices(
  adminDb: Firestore,
  messaging: Messaging,
  userId: string,
  message: Message,
  match: NotificationMatch,
): Promise<{ successCount: number; notifications: DeviceNotification[] }> {
  const subscriptions = await getUserSubscriptions(adminDb, userId);

  if (subscriptions.length === 0) {
    console.log(`   ⏭️  No subscriptions for user ${userId.substring(0, 8)}`);
    return { successCount: 0, notifications: [] };
  }

  const deviceNotifications: DeviceNotification[] = [];
  let successCount = 0;

  for (const subscription of subscriptions) {
    const result = await sendPushNotification(
      adminDb,
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
  adminDb: Firestore,
  matchId: string,
  messageData: Record<string, unknown>,
  deviceNotifications: DeviceNotification[],
): Promise<void> {
  const messageSnapshot: Record<string, string> = {
    text: (messageData?.text as string) || "",
    createdAt: convertTimestamp(messageData?.createdAt),
  };

  // Only add optional fields if they exist (avoid undefined in Firestore)
  if (messageData?.source) {
    messageSnapshot.source = messageData.source as string;
  }
  if (messageData?.sourceUrl) {
    messageSnapshot.sourceUrl = messageData.sourceUrl as string;
  }

  await adminDb.collection("notificationMatches").doc(matchId).update({
    deviceNotifications,
    messageSnapshot,
  });
}

/**
 * Mark matches as notified
 */
export async function markMatchesAsNotified(
  adminDb: Firestore,
  matchIds: string[],
): Promise<void> {
  console.log(`\n   📝 Marking ${matchIds.length} matches as notified...`);

  const matchesRef = adminDb.collection("notificationMatches");
  const now = new Date();

  for (const matchId of matchIds) {
    await matchesRef.doc(matchId).update({
      notified: true,
      notifiedAt: now,
    });
  }
}
