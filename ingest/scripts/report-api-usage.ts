#!/usr/bin/env tsx
/**
 * Generate a tabular report for public API usage.
 *
 * Reads hourly usage buckets from `apiUsageHourly`, aggregates totals,
 * and prints top rows using console.table.
 *
 * Usage:
 *   pnpm report:api-usage
 *   pnpm report:api-usage --hours 72 --limit 30
 *   pnpm report:api-usage --json
 */

import { Command } from "commander";
import dotenv from "dotenv";
import { resolve } from "node:path";
import { getNumber, getString } from "@/lib/record-fields";

type UsageBucket = {
  principalId: string;
  principalType: string;
  method: string;
  endpoint: string;
  periodStart: string;
  totalCount: number;
  status2xxCount: number;
  status4xxCount: number;
  status5xxCount: number;
};

type Aggregate = {
  totalCount: number;
  status2xxCount: number;
  status4xxCount: number;
  status5xxCount: number;
};

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function getCutoffIso(hours: number): string {
  const now = new Date();
  const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);
  return cutoff.toISOString();
}

function toUsageBucket(doc: Record<string, unknown>): UsageBucket | null {
  const principalId = getString(doc.principalId);
  const method = getString(doc.method).toUpperCase();
  const endpoint = getString(doc.endpoint);
  const periodStart = getString(doc.periodStart);

  if (!principalId || !method || !endpoint || !periodStart) {
    return null;
  }

  return {
    principalId,
    principalType: getString(doc.principalType, "unknown"),
    method,
    endpoint,
    periodStart,
    totalCount: getNumber(doc.totalCount, 0),
    status2xxCount: getNumber(doc.status2xxCount, 0),
    status4xxCount: getNumber(doc.status4xxCount, 0),
    status5xxCount: getNumber(doc.status5xxCount, 0),
  };
}

function emptyAggregate(): Aggregate {
  return {
    totalCount: 0,
    status2xxCount: 0,
    status4xxCount: 0,
    status5xxCount: 0,
  };
}

function addToAggregate(target: Aggregate, bucket: UsageBucket): void {
  target.totalCount += bucket.totalCount;
  target.status2xxCount += bucket.status2xxCount;
  target.status4xxCount += bucket.status4xxCount;
  target.status5xxCount += bucket.status5xxCount;
}

function errorRatePercent(agg: Aggregate): number {
  if (agg.totalCount <= 0) {
    return 0;
  }
  const errors = agg.status4xxCount + agg.status5xxCount;
  return Math.round((errors / agg.totalCount) * 10000) / 100;
}

function topRows<T extends { totalCount: number }>(
  items: T[],
  limit: number,
): T[] {
  return [...items].sort((a, b) => b.totalCount - a.totalCount).slice(0, limit);
}

function aggregateByEndpoint(buckets: UsageBucket[]): Array<{
  method: string;
  endpoint: string;
  totalCount: number;
  status2xxCount: number;
  status4xxCount: number;
  status5xxCount: number;
  errorRatePct: number;
}> {
  const grouped = new Map<
    string,
    { method: string; endpoint: string; agg: Aggregate }
  >();

  for (const bucket of buckets) {
    const key = `${bucket.method} ${bucket.endpoint}`;
    const existing = grouped.get(key);
    if (existing) {
      addToAggregate(existing.agg, bucket);
      continue;
    }

    const agg = emptyAggregate();
    addToAggregate(agg, bucket);
    grouped.set(key, {
      method: bucket.method,
      endpoint: bucket.endpoint,
      agg,
    });
  }

  const rows = Array.from(grouped.values()).map((entry) => ({
    method: entry.method,
    endpoint: entry.endpoint,
    totalCount: entry.agg.totalCount,
    status2xxCount: entry.agg.status2xxCount,
    status4xxCount: entry.agg.status4xxCount,
    status5xxCount: entry.agg.status5xxCount,
    errorRatePct: errorRatePercent(entry.agg),
  }));

  return rows;
}

function aggregateByPrincipal(buckets: UsageBucket[]): Array<{
  principalId: string;
  principalType: string;
  totalCount: number;
  status2xxCount: number;
  status4xxCount: number;
  status5xxCount: number;
  errorRatePct: number;
}> {
  const grouped = new Map<string, { principalType: string; agg: Aggregate }>();

  for (const bucket of buckets) {
    const existing = grouped.get(bucket.principalId);
    if (existing) {
      addToAggregate(existing.agg, bucket);
      continue;
    }

    const agg = emptyAggregate();
    addToAggregate(agg, bucket);
    grouped.set(bucket.principalId, {
      principalType: bucket.principalType,
      agg,
    });
  }

  const rows = Array.from(grouped.entries()).map(([principalId, entry]) => ({
    principalId,
    principalType: entry.principalType,
    totalCount: entry.agg.totalCount,
    status2xxCount: entry.agg.status2xxCount,
    status4xxCount: entry.agg.status4xxCount,
    status5xxCount: entry.agg.status5xxCount,
    errorRatePct: errorRatePercent(entry.agg),
  }));

  return rows;
}

function aggregateByPrincipalEndpoint(buckets: UsageBucket[]): Array<{
  principalId: string;
  method: string;
  endpoint: string;
  totalCount: number;
  status2xxCount: number;
  status4xxCount: number;
  status5xxCount: number;
  errorRatePct: number;
}> {
  const grouped = new Map<
    string,
    { principalId: string; method: string; endpoint: string; agg: Aggregate }
  >();

  for (const bucket of buckets) {
    const key = `${bucket.principalId}|${bucket.method}|${bucket.endpoint}`;
    const existing = grouped.get(key);
    if (existing) {
      addToAggregate(existing.agg, bucket);
      continue;
    }

    const agg = emptyAggregate();
    addToAggregate(agg, bucket);
    grouped.set(key, {
      principalId: bucket.principalId,
      method: bucket.method,
      endpoint: bucket.endpoint,
      agg,
    });
  }

  return Array.from(grouped.values()).map((entry) => ({
    principalId: entry.principalId,
    method: entry.method,
    endpoint: entry.endpoint,
    totalCount: entry.agg.totalCount,
    status2xxCount: entry.agg.status2xxCount,
    status4xxCount: entry.agg.status4xxCount,
    status5xxCount: entry.agg.status5xxCount,
    errorRatePct: errorRatePercent(entry.agg),
  }));
}

function aggregateSummary(buckets: UsageBucket[]): Aggregate {
  const summary = emptyAggregate();
  for (const bucket of buckets) {
    addToAggregate(summary, bucket);
  }
  return summary;
}

async function runReport(opts: {
  hours: number;
  limit: number;
  json?: boolean;
}): Promise<void> {
  const cutoffIso = getCutoffIso(opts.hours);
  const { getDb, closeDb } = await import("@/lib/db");

  const db = await getDb();
  try {
    const docs = await db.client.findMany("apiUsageHourly", {
      where: [{ field: "periodStart", op: ">=", value: cutoffIso }],
      orderBy: [{ field: "periodStart", direction: "desc" }],
    });

    const buckets = docs
      .map((doc) => toUsageBucket(doc))
      .filter((doc): doc is UsageBucket => doc !== null);

    const summary = aggregateSummary(buckets);
    const endpointRows = topRows(aggregateByEndpoint(buckets), opts.limit);
    const principalRows = topRows(aggregateByPrincipal(buckets), opts.limit);
    const principalEndpointRows = topRows(
      aggregateByPrincipalEndpoint(buckets),
      opts.limit,
    );

    if (opts.json) {
      console.log(
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            hours: opts.hours,
            cutoffIso,
            buckets: buckets.length,
            summary: {
              totalCount: summary.totalCount,
              status2xxCount: summary.status2xxCount,
              status4xxCount: summary.status4xxCount,
              status5xxCount: summary.status5xxCount,
              errorRatePct: errorRatePercent(summary),
            },
            topEndpoints: endpointRows,
            topPrincipals: principalRows,
            topPrincipalEndpointPairs: principalEndpointRows,
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(
      `\nAPI usage report (last ${opts.hours}h, buckets: ${buckets.length})`,
    );

    console.table([
      {
        totalCount: summary.totalCount,
        status2xxCount: summary.status2xxCount,
        status4xxCount: summary.status4xxCount,
        status5xxCount: summary.status5xxCount,
        errorRatePct: errorRatePercent(summary),
      },
    ]);

    console.log("\nTop endpoints:");
    console.table(endpointRows);

    console.log("\nTop principals:");
    console.table(principalRows);

    console.log("\nTop principal+endpoint pairs:");
    console.table(principalEndpointRows);
  } finally {
    await closeDb();
  }
}

const program = new Command();

program
  .name("report-api-usage")
  .description("Report public API usage from hourly usage buckets")
  .option(
    "--hours <n>",
    "Lookback window in hours",
    (value: string) => parsePositiveInt(value, 24),
    24,
  )
  .option(
    "--limit <n>",
    "Maximum rows per table",
    (value: string) => parsePositiveInt(value, 20),
    20,
  )
  .option("--json", "Output report as JSON")
  .addHelpText(
    "after",
    `
Examples:
  $ pnpm report:api-usage
  $ pnpm report:api-usage --hours 72 --limit 30
  $ pnpm report:api-usage --json
`,
  )
  .action(async (opts: { hours: number; limit: number; json?: boolean }) => {
    dotenv.config({ path: resolve(process.cwd(), ".env.local") });

    try {
      await runReport(opts);
    } catch (error) {
      console.error("Fatal error", {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  });

program.parseAsync().catch((error) => {
  console.error(error);
  process.exit(1);
});
