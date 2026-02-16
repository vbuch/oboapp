/**
 * Notification subscriptions collection repository.
 */

import type { DbClient, FindManyOptions, WhereClause } from "../types";

/** Collection name constant */
export const NOTIFICATION_SUBSCRIPTIONS_COLLECTION =
  "notificationSubscriptions";

export class NotificationSubscriptionsRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<Record<string, unknown> | null> {
    return this.db.findOne(NOTIFICATION_SUBSCRIPTIONS_COLLECTION, id);
  }

  async findMany(
    options?: FindManyOptions,
  ): Promise<Record<string, unknown>[]> {
    return this.db.findMany(NOTIFICATION_SUBSCRIPTIONS_COLLECTION, options);
  }

  async insertOne(data: Record<string, unknown>): Promise<string> {
    return this.db.insertOne(NOTIFICATION_SUBSCRIPTIONS_COLLECTION, data);
  }

  async updateOne(id: string, data: Record<string, unknown>): Promise<void> {
    return this.db.updateOne(NOTIFICATION_SUBSCRIPTIONS_COLLECTION, id, data);
  }

  async deleteOne(id: string): Promise<void> {
    return this.db.deleteOne(NOTIFICATION_SUBSCRIPTIONS_COLLECTION, id);
  }

  /** Find subscriptions for a user */
  async findByUserId(userId: string): Promise<Record<string, unknown>[]> {
    return this.db.findMany(NOTIFICATION_SUBSCRIPTIONS_COLLECTION, {
      where: [{ field: "userId", op: "==", value: userId }],
    });
  }

  /** Find a specific subscription by user and token */
  async findByUserAndToken(
    userId: string,
    token: string,
  ): Promise<Record<string, unknown> | null> {
    const results = await this.db.findMany(
      NOTIFICATION_SUBSCRIPTIONS_COLLECTION,
      {
        where: [
          { field: "userId", op: "==", value: userId },
          { field: "token", op: "==", value: token },
        ],
        limit: 1,
      },
    );
    return results[0] ?? null;
  }

  /** Check if a user has any subscription */
  async hasSubscription(userId: string): Promise<boolean> {
    const results = await this.db.findMany(
      NOTIFICATION_SUBSCRIPTIONS_COLLECTION,
      {
        where: [{ field: "userId", op: "==", value: userId }],
        limit: 1,
      },
    );
    return results.length > 0;
  }

  /**
   * Delete all subscriptions for a user (used in user deletion cascade).
   */
  async deleteAllByUserId(userId: string): Promise<number> {
    return this.db.deleteMany(NOTIFICATION_SUBSCRIPTIONS_COLLECTION, [
      { field: "userId", op: "==", value: userId },
    ]);
  }

  async count(where?: WhereClause[]): Promise<number> {
    return this.db.count(NOTIFICATION_SUBSCRIPTIONS_COLLECTION, where);
  }
}
