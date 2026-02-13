import type { OboDb } from "@oboapp/db";
import { NotificationSubscription } from "@/lib/types";
import { logger } from "@/lib/logger";

function toDateOrString(value: unknown): Date | string {
  if (value instanceof Date) return value;
  if (typeof value === "string") return value;
  return new Date();
}

/**
 * Get user subscriptions
 */
export async function getUserSubscriptions(
  db: OboDb,
  userId: string,
): Promise<NotificationSubscription[]> {
  const docs = await db.notificationSubscriptions.findByUserId(userId);

  return docs.map((data) => ({
    id: data._id as string,
    userId: data.userId as string,
    token: data.token as string,
    endpoint: data.endpoint as string,
    createdAt: toDateOrString(data.createdAt),
    updatedAt: toDateOrString(data.updatedAt),
    deviceInfo: data.deviceInfo as NotificationSubscription["deviceInfo"],
  }));
}

/**
 * Delete invalid subscription from database
 */
export async function deleteSubscription(
  db: OboDb,
  subscriptionId: string,
): Promise<void> {
  await db.notificationSubscriptions.deleteOne(subscriptionId);
  logger.info("Removed invalid subscription", { subscriptionId: subscriptionId.substring(0, 8) });
}
