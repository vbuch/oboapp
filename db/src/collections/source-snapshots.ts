import { SourceSnapshotSchema, getSofiaDayRange, type SourceSnapshot } from "@oboapp/shared";
import type { DbClient } from "../types";

export const SOURCE_SNAPSHOTS_COLLECTION = "sourceSnapshots";
const RANGE_CAPTURE_LIMIT = 256;

export class SourceSnapshotsRepository {
  constructor(private readonly db: DbClient) {}

  /** Captures in (after, through], oldest first. Never silently truncate history. */
  async findRange(
    sourceType: string,
    locality: string,
    after: string,
    through: string,
  ): Promise<{ snapshots: SourceSnapshot[]; truncated: boolean }> {
    const records = await this.db.findMany(SOURCE_SNAPSHOTS_COLLECTION, {
      where: [
        { field: "locality", op: "==", value: locality },
        { field: "sourceType", op: "==", value: sourceType },
        { field: "observedAt", op: ">", value: after },
        { field: "observedAt", op: "<=", value: through },
      ],
      // Reuse the existing descending observation index on both databases.
      orderBy: [{ field: "observedAt", direction: "desc" }],
      limit: RANGE_CAPTURE_LIMIT + 1,
    });
    return {
      snapshots: records.slice(0, RANGE_CAPTURE_LIMIT).reverse().map((record) => {
        return SourceSnapshotSchema.parse(record);
      }),
      truncated: records.length > RANGE_CAPTURE_LIMIT,
    };
  }

  async findLatestForDate(
    sourceType: string,
    locality: string,
    date: string,
  ): Promise<SourceSnapshot | null> {
    const { start, end } = getSofiaDayRange(date);
    const records = await this.db.findMany(SOURCE_SNAPSHOTS_COLLECTION, {
      where: [
        { field: "locality", op: "==", value: locality },
        { field: "sourceType", op: "==", value: sourceType },
        { field: "observedAt", op: ">=", value: start },
        { field: "observedAt", op: "<", value: end },
      ],
      orderBy: [{ field: "observedAt", direction: "desc" }],
      limit: 1,
    });
    return records[0] ? SourceSnapshotSchema.parse(records[0]) : null;
  }

  async save(snapshot: SourceSnapshot): Promise<void> {
    const validated = SourceSnapshotSchema.parse(snapshot);
    const data: SourceSnapshot = {
      ...validated,
      observedAt: new Date(validated.observedAt).toISOString(),
    };
    const id = [data.locality, data.sourceType, data.observedAt]
      .map(encodeURIComponent)
      .join(":");

    await this.db.batchWrite([
      { type: "set", collection: SOURCE_SNAPSHOTS_COLLECTION, id, data },
    ]);
  }

  async findLatest(
    sourceType: string,
    locality: string,
  ): Promise<SourceSnapshot | null> {
    const snapshots = await this.db.findMany(SOURCE_SNAPSHOTS_COLLECTION, {
      where: [
        { field: "locality", op: "==", value: locality },
        { field: "sourceType", op: "==", value: sourceType },
      ],
      orderBy: [{ field: "observedAt", direction: "desc" }],
      limit: 1,
    });
    const snapshot = snapshots[0];

    if (!snapshot) {
      return null;
    }

    return SourceSnapshotSchema.parse(snapshot);
  }
}
