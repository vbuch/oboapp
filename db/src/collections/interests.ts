/**
 * Interests collection repository.
 */

import type { DbClient, FindManyOptions, WhereClause, BatchOperation } from "../types";

/** Collection name constant */
export const INTERESTS_COLLECTION = "interests";

export class InterestsRepository {
  constructor(private db: DbClient) {}

  async findById(id: string): Promise<Record<string, unknown> | null> {
    return this.db.findOne(INTERESTS_COLLECTION, id);
  }

  async findMany(options?: FindManyOptions): Promise<Record<string, unknown>[]> {
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
  async deleteAllByUserId(userId: string): Promise<void> {
    const docs = await this.db.findMany(INTERESTS_COLLECTION, {
      where: [{ field: "userId", op: "==", value: userId }],
    });
    if (docs.length === 0) return;

    const ops: BatchOperation[] = docs.map((doc) => ({
      type: "delete" as const,
      collection: INTERESTS_COLLECTION,
      id: doc._id as string,
    }));
    await this.db.batchWrite(ops);
  }

  async count(where?: WhereClause[]): Promise<number> {
    return this.db.count(INTERESTS_COLLECTION, where);
  }
}
