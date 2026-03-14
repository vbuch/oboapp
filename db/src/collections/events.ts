/**
 * Events collection repository.
 *
 * Stores aggregated real-world incidents composed of one or more messages.
 */

import type { DbClient, FindManyOptions, WhereClause } from "../types";

/** Collection name constant */
export const EVENTS_COLLECTION = "events";

export class EventsRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<Record<string, unknown> | null> {
    return this.db.findOne(EVENTS_COLLECTION, id);
  }

  async findMany(
    options?: FindManyOptions,
  ): Promise<Record<string, unknown>[]> {
    return this.db.findMany(EVENTS_COLLECTION, options);
  }

  async insertOne(
    data: Record<string, unknown>,
    id?: string,
  ): Promise<string> {
    return this.db.insertOne(EVENTS_COLLECTION, data, id);
  }

  async updateOne(id: string, data: Record<string, unknown>): Promise<void> {
    return this.db.updateOne(EVENTS_COLLECTION, id, data);
  }

  async deleteOne(id: string): Promise<void> {
    return this.db.deleteOne(EVENTS_COLLECTION, id);
  }

  async count(where?: WhereClause[]): Promise<number> {
    return this.db.count(EVENTS_COLLECTION, where);
  }

  /**
   * Find candidate events for matching.
   * Queries by locality + time window. Spatial filtering is done in-memory.
   */
  async findCandidates(
    locality: string,
    timeWindowStart: Date,
    timeWindowEnd: Date,
    options?: { cityWideOnly?: boolean },
  ): Promise<Record<string, unknown>[]> {
    const where: WhereClause[] = [
      { field: "locality", op: "==", value: locality },
      {
        field: "timespanEnd",
        op: ">=",
        value: timeWindowStart.toISOString(),
      },
      {
        field: "timespanStart",
        op: "<=",
        value: timeWindowEnd.toISOString(),
      },
    ];

    if (options?.cityWideOnly) {
      where.push({ field: "cityWide", op: "==", value: true });
    }

    return this.db.findMany(EVENTS_COLLECTION, { where });
  }
}
