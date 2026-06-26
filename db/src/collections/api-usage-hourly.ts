/**
 * Per-principal per-endpoint API usage counters (hour buckets).
 */

import type { DbClient } from "../types";

/** Collection name constant */
export const API_USAGE_HOURLY_COLLECTION = "apiUsageHourly";

export type StatusClass = "2xx" | "4xx" | "5xx";

export function makeBucketId(params: {
  principalId: string;
  periodStart: string;
  method: string;
  endpoint: string;
}): string {
  const endpointKey = encodeURIComponent(params.endpoint);
  return `${params.principalId}:${params.periodStart}:${params.method}:${endpointKey}`;
}

function hasCode(error: Error): error is Error & { code?: unknown } {
  return "code" in error;
}

export function isAlreadyExistsError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const maybeCode = hasCode(error) ? error.code : undefined;
  return (
    error.message.includes("already exists") ||
    error.message.includes("ALREADY_EXISTS") ||
    maybeCode === 6 ||
    maybeCode === 11000
  );
}

export function statusClassField(statusClass: StatusClass): string {
  if (statusClass === "2xx") return "status2xxCount";
  if (statusClass === "4xx") return "status4xxCount";
  return "status5xxCount";
}

export class ApiUsageHourlyRepository {
  constructor(private readonly db: DbClient) {}

  async increment(params: {
    principalId: string;
    principalType: string;
    method: string;
    endpoint: string;
    periodStart: string;
    statusClass: StatusClass;
    nowIso: string;
  }): Promise<void> {
    const {
      principalId,
      principalType,
      method,
      endpoint,
      periodStart,
      statusClass,
      nowIso,
    } = params;

    const bucketId = makeBucketId({
      principalId,
      periodStart,
      method,
      endpoint,
    });
    const statusField = statusClassField(statusClass);

    try {
      await this.db.createOne(
        API_USAGE_HOURLY_COLLECTION,
        {
          principalId,
          principalType,
          method,
          endpoint,
          periodStart,
          totalCount: 1,
          status2xxCount: statusClass === "2xx" ? 1 : 0,
          status4xxCount: statusClass === "4xx" ? 1 : 0,
          status5xxCount: statusClass === "5xx" ? 1 : 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        bucketId,
      );
      return;
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }
    }

    await this.db.updateOne(API_USAGE_HOURLY_COLLECTION, bucketId, {
      $inc: {
        totalCount: 1,
        [statusField]: 1,
      },
      $set: { updatedAt: nowIso },
    });
  }
}
