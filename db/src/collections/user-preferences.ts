/**
 * User preferences collection repository.
 *
 * Stores per-user settings such as notification filter preferences.
 * Each user has at most one document in this collection.
 */

import type { DbClient, FindManyOptions } from "../types";

/** Collection name constant */
export const USER_PREFERENCES_COLLECTION = "userPreferences";

export class UserPreferencesRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<Record<string, unknown> | null> {
    return this.db.findOne(USER_PREFERENCES_COLLECTION, id);
  }

  async findMany(
    options?: FindManyOptions,
  ): Promise<Record<string, unknown>[]> {
    return this.db.findMany(USER_PREFERENCES_COLLECTION, options);
  }

  async insertOne(data: Record<string, unknown>): Promise<string> {
    return this.db.insertOne(USER_PREFERENCES_COLLECTION, data);
  }

  async updateOne(id: string, data: Record<string, unknown>): Promise<void> {
    return this.db.updateOne(USER_PREFERENCES_COLLECTION, id, data);
  }

  async deleteOne(id: string): Promise<void> {
    return this.db.deleteOne(USER_PREFERENCES_COLLECTION, id);
  }

  /** Find preferences for a user (returns first match or null) */
  async findByUserId(userId: string): Promise<Record<string, unknown> | null> {
    const results = await this.db.findMany(USER_PREFERENCES_COLLECTION, {
      where: [{ field: "userId", op: "==", value: userId }],
      limit: 1,
    });
    return results[0] ?? null;
  }

  /**
   * Create or update preferences for a user.
   * If a document already exists for the userId, it is updated.
   * Otherwise a new document is created.
   * Returns the document ID.
   */
  async upsertByUserId(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    const existing = await this.findByUserId(userId);
    const now = new Date();

    if (existing) {
      const docId = existing._id as string;
      await this.updateOne(docId, { ...data, updatedAt: now });
      return docId;
    }

    return this.insertOne({
      ...data,
      userId,
      createdAt: now,
      updatedAt: now,
    });
  }
}
