/**
 * GTFS stops collection repository.
 *
 * Document ID = stopCode (external identifier).
 */

import type { DbClient, FindManyOptions, WhereClause, BatchOperation } from "../types";

/** Collection name constant */
export const GTFS_STOPS_COLLECTION = "gtfsStops";

export class GtfsStopsRepository {
  constructor(private db: DbClient) {}

  async findById(stopCode: string): Promise<Record<string, unknown> | null> {
    return this.db.findOne(GTFS_STOPS_COLLECTION, stopCode);
  }

  async findMany(options?: FindManyOptions): Promise<Record<string, unknown>[]> {
    return this.db.findMany(GTFS_STOPS_COLLECTION, options);
  }

  /**
   * Upsert a batch of stops (like Firestore's batch set with merge).
   * Chunks into groups of 100 for efficiency.
   */
  async upsertBatch(
    stops: { stopCode: string; data: Record<string, unknown> }[],
  ): Promise<void> {
    const BATCH_SIZE = 100;
    for (let i = 0; i < stops.length; i += BATCH_SIZE) {
      const chunk = stops.slice(i, i + BATCH_SIZE);
      const ops: BatchOperation[] = chunk.map((stop) => ({
        type: "set" as const,
        collection: GTFS_STOPS_COLLECTION,
        id: stop.stopCode,
        data: stop.data,
        merge: true,
      }));
      await this.db.batchWrite(ops);
    }
  }

  async count(where?: WhereClause[]): Promise<number> {
    return this.db.count(GTFS_STOPS_COLLECTION, where);
  }
}
