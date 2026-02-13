/**
 * Sources collection repository.
 *
 * Wraps DbClient with source-specific helpers.
 * Document IDs are Base64-encoded URLs (via encodeDocumentId).
 */

import type { DbClient, FindManyOptions, WhereClause, BatchOperation } from "../types";

/** Collection name constant */
export const SOURCES_COLLECTION = "sources";

export class SourcesRepository {
  constructor(private db: DbClient) {}

  async findById(id: string): Promise<Record<string, unknown> | null> {
    return this.db.findOne(SOURCES_COLLECTION, id);
  }

  async findMany(options?: FindManyOptions): Promise<Record<string, unknown>[]> {
    return this.db.findMany(SOURCES_COLLECTION, options);
  }

  async insertOne(data: Record<string, unknown>, id: string): Promise<string> {
    return this.db.insertOne(SOURCES_COLLECTION, data, id);
  }

  /**
   * Set (upsert) a source document with a given ID.
   */
  async setOne(id: string, data: Record<string, unknown>): Promise<void> {
    await this.db.batchWrite([
      { type: "set", collection: SOURCES_COLLECTION, id, data },
    ]);
  }

  async updateOne(id: string, data: Record<string, unknown>): Promise<void> {
    return this.db.updateOne(SOURCES_COLLECTION, id, data);
  }

  async deleteOne(id: string): Promise<void> {
    return this.db.deleteOne(SOURCES_COLLECTION, id);
  }

  async deleteMany(where: WhereClause[]): Promise<number> {
    return this.db.deleteMany(SOURCES_COLLECTION, where);
  }

  /**
   * Batch delete by document IDs.
   */
  async deleteManyByIds(ids: string[]): Promise<void> {
    const BATCH_SIZE = 500;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const chunk = ids.slice(i, i + BATCH_SIZE);
      const ops: BatchOperation[] = chunk.map((id) => ({
        type: "delete" as const,
        collection: SOURCES_COLLECTION,
        id,
      }));
      await this.db.batchWrite(ops);
    }
  }

  async count(where?: WhereClause[]): Promise<number> {
    return this.db.count(SOURCES_COLLECTION, where);
  }
}
