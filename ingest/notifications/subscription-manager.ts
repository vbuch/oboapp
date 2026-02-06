import type { Firestore } from "firebase-admin/firestore";
import { NotificationSubscription } from "@/lib/types";
import { convertTimestamp } from "./utils";
import { logger } from "@/lib/logger";

/**
 * Get user subscriptions
 */
export async function getUserSubscriptions(
  adminDb: Firestore,
  userId: string,
): Promise<NotificationSubscription[]> {
  const subscriptionsRef = adminDb.collection("notificationSubscriptions");
  const snapshot = await subscriptionsRef.where("userId", "==", userId).get();

  const subscriptions: NotificationSubscription[] = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    subscriptions.push({
      id: doc.id,
      userId: data.userId,
      token: data.token,
      endpoint: data.endpoint,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
      deviceInfo: data.deviceInfo,
    });
  });

  return subscriptions;
}

/**
 * Delete invalid subscription from database
 */
export async function deleteSubscription(
  adminDb: Firestore,
  subscriptionId: string,
): Promise<void> {
  await adminDb
    .collection("notificationSubscriptions")
    .doc(subscriptionId)
    .delete();
  logger.info("Removed invalid subscription", { subscriptionId: subscriptionId.substring(0, 8) });
}
