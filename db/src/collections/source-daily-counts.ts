import {
  SourceDailyCountSchema,
  getSofiaDateKey,
  validateCalendarDate,
  type SourceDailyCount,
} from "@oboapp/shared";
import type { DbClient } from "../types";

export const SOURCE_DAILY_COUNTS_COLLECTION = "sourceDailyCounts";

function dailyCountId(sourceType: string, locality: string, date: string): string {
  return [locality, sourceType, date].map(encodeURIComponent).join(":");
}

export class SourceDailyCountsRepository {
  constructor(private readonly db: DbClient) {}

  async save(count: SourceDailyCount): Promise<void> {
    const validated = SourceDailyCountSchema.parse(count);
    const observedAt = new Date(validated.observedAt).toISOString();
    if (getSofiaDateKey(new Date(observedAt)) !== validated.date) {
      throw new Error("Daily count must use the Sofia date of its source observation");
    }
    await this.db.batchWrite([
      {
        type: "set",
        collection: SOURCE_DAILY_COUNTS_COLLECTION,
        id: dailyCountId(validated.sourceType, validated.locality, validated.date),
        data: { ...validated, observedAt },
      },
    ]);
  }

  async findByDate(
    sourceType: string,
    locality: string,
    date: string,
  ): Promise<SourceDailyCount | null> {
    validateCalendarDate(date);
    const record = await this.db.findOne(
      SOURCE_DAILY_COUNTS_COLLECTION,
      dailyCountId(sourceType, locality, date),
    );
    return record ? SourceDailyCountSchema.parse(record) : null;
  }

  async findRange(
    sourceType: string,
    locality: string,
    from: string,
    to: string,
  ): Promise<SourceDailyCount[]> {
    validateCalendarDate(from);
    validateCalendarDate(to);
    const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
    if (days < 0 || days > 365) {
      throw new Error("Daily count queries must cover between one and 366 days");
    }
    const records = await this.db.findMany(SOURCE_DAILY_COUNTS_COLLECTION, {
      where: [
        { field: "locality", op: "==", value: locality },
        { field: "sourceType", op: "==", value: sourceType },
        { field: "date", op: ">=", value: from },
        { field: "date", op: "<=", value: to },
      ],
      orderBy: [{ field: "date", direction: "asc" }],
      limit: 366,
    });
    return records.map((record) => {
      return SourceDailyCountSchema.parse(record);
    });
  }
}
