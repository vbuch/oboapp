/**
 * Sensor community readings collection repository.
 *
 * Stores raw PM2.5/PM10 readings from sensor.community API.
 * Document IDs are deterministic: `${sensorId}_${isoTimestamp}`.
 */

import type {
  DbClient,
  FindManyOptions,
  WhereClause,
  BatchOperation,
} from "../types";

/** Collection name constant */
export const SENSOR_COMMUNITY_READINGS_COLLECTION =
  "sensorCommunityReadings";

export class SensorCommunityReadingsRepository {
  constructor(private db: DbClient) {}

  async findById(id: string): Promise<Record<string, unknown> | null> {
    return this.db.findOne(SENSOR_COMMUNITY_READINGS_COLLECTION, id);
  }

  async findMany(
    options?: FindManyOptions,
  ): Promise<Record<string, unknown>[]> {
    return this.db.findMany(SENSOR_COMMUNITY_READINGS_COLLECTION, options);
  }

  /**
   * Create a reading with a specific deterministic ID.
   * Uses atomic create — fails silently if the ID already exists (dedup).
   */
  async createOne(
    id: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    return this.db.createOne(
      SENSOR_COMMUNITY_READINGS_COLLECTION,
      data,
      id,
    );
  }

  async insertOne(
    data: Record<string, unknown>,
    id?: string,
  ): Promise<string> {
    return this.db.insertOne(SENSOR_COMMUNITY_READINGS_COLLECTION, data, id);
  }

  async deleteOne(id: string): Promise<void> {
    return this.db.deleteOne(SENSOR_COMMUNITY_READINGS_COLLECTION, id);
  }

  async count(where?: WhereClause[]): Promise<number> {
    return this.db.count(SENSOR_COMMUNITY_READINGS_COLLECTION, where);
  }

  /**
   * Find readings for a locality within a time range.
   * Used by the crawler to get the evaluation window of readings.
   */
  async findByLocalityAndTimeRange(
    locality: string,
    start: Date,
    end: Date,
  ): Promise<Record<string, unknown>[]> {
    return this.db.findMany(SENSOR_COMMUNITY_READINGS_COLLECTION, {
      where: [
        { field: "locality", op: "==", value: locality },
        { field: "timestamp", op: ">=", value: start },
        { field: "timestamp", op: "<=", value: end },
      ],
      orderBy: [{ field: "timestamp", direction: "desc" }],
    });
  }

  /**
   * Delete readings older than the given date.
   * Chunked to respect Firestore's 500-per-batch limit.
   */
  async deleteOlderThan(cutoff: Date): Promise<number> {
    const oldReadings = await this.db.findMany(
      SENSOR_COMMUNITY_READINGS_COLLECTION,
      {
        where: [{ field: "timestamp", op: "<", value: cutoff }],
        select: ["_id"],
      },
    );

    if (oldReadings.length === 0) return 0;

    const BATCH_SIZE = 500;
    for (let i = 0; i < oldReadings.length; i += BATCH_SIZE) {
      const chunk = oldReadings.slice(i, i + BATCH_SIZE);
      const ops: BatchOperation[] = chunk.map((doc) => ({
        type: "delete" as const,
        collection: SENSOR_COMMUNITY_READINGS_COLLECTION,
        id: doc._id as string,
      }));
      await this.db.batchWrite(ops);
    }

    return oldReadings.length;
  }
}
