/**
 * Interests collection repository.
 */

import type { DbClient, FindManyOptions, WhereClause } from "../types";

/** Collection name constant */
export const INTERESTS_COLLECTION = "interests";

export class InterestsRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<Record<string, unknown> | null> {
    return this.db.findOne(INTERESTS_COLLECTION, id);
  }

  async findMany(
    options?: FindManyOptions,
  ): Promise<Record<string, unknown>[]> {
    return this.db.findMany(INTERESTS_COLLECTION, options);
  }

  async insertOne(data: Record<string, unknown>): Promise<string> {
    return this.db.insertOne(INTERESTS_COLLECTION, data);
  }

  async updateOne(id: string, data: Record<string, unknown>): Promise<void> {
    return this.db.updateOne(INTERESTS_COLLECTION, id, data);
  }

  async deleteOne(id: string): Promise<void> {
    return this.db.deleteOne(INTERESTS_COLLECTION, id);
  }

  async findByUserId(userId: string): Promise<Record<string, unknown>[]> {
    return this.db.findMany(INTERESTS_COLLECTION, {
      where: [{ field: "userId", op: "==", value: userId }],
      orderBy: [{ field: "createdAt", direction: "desc" }],
    });
  }

  /**
   * Delete all interests for a user (used in user deletion cascade).
   */
  async deleteAllByUserId(userId: string): Promise<number> {
    return this.db.deleteMany(INTERESTS_COLLECTION, [
      { field: "userId", op: "==", value: userId },
    ]);
  }

  async count(where?: WhereClause[]): Promise<number> {
    return this.db.count(INTERESTS_COLLECTION, where);
  }
}
