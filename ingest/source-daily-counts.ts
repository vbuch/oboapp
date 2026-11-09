#!/usr/bin/env node
import { Command } from "commander";
import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { OboDb } from "@oboapp/db";
import {
  SOURCES,
  SourceDailyCountSchema,
  getSofiaDateKey,
  validateCalendarDate,
  type SourceDailyCount,
} from "@oboapp/shared";
import { logger } from "@/lib/logger";

interface DailyCountOptions {
  sourceType: string;
  locality: string;
  date: string;
}

export async function recordSourceDailyCount(
  db: OboDb,
  options: DailyCountOptions,
): Promise<SourceDailyCount | null> {
  const date = validateCalendarDate(options.date);
  const snapshot = await db.sourceSnapshots.findLatestForDate(
    options.sourceType,
    options.locality,
    date,
  );
  if (!snapshot) {
    return null;
  }
  const dailyCount: SourceDailyCount = {
    sourceType: snapshot.sourceType,
    locality: snapshot.locality,
    count: snapshot.count,
    observedAt: snapshot.observedAt,
    date,
  };
  await db.sourceDailyCounts.save(dailyCount);
  return dailyCount;
}

export async function importSourceDailyCounts(
  db: OboDb,
  input: unknown,
): Promise<number> {
  const observations = SourceDailyCountSchema.array().min(1).parse(input);
  const identities = new Set<string>();
  for (const observation of observations) {
    const identity = `${observation.locality}:${observation.sourceType}:${observation.date}`;
    if (identities.has(identity)) {
      throw new Error("Imported daily counts must contain one point per source and date");
    }
    identities.add(identity);
    const source = SOURCES.find((candidate) => {
      return candidate.id === observation.sourceType &&
        candidate.localities.includes(observation.locality);
    });
    if (!source || getSofiaDateKey(new Date(observation.observedAt)) !== observation.date) {
      throw new Error("Imported daily count must have a configured source and matching Sofia observation date");
    }
  }
  for (const observation of observations) {
    await db.sourceDailyCounts.save(observation);
  }
  return observations.length;
}

async function main(): Promise<void> {
  dotenv.config({ path: resolve(process.cwd(), ".env.local") });
  const program = new Command()
    .name("source-daily-counts")
    .description("Keep one closing source count for each Sofia calendar day")
    .option("--source <id>", "Configured source ID", "toplo-bg")
    .option("--date <YYYY-MM-DD>", "Sofia date to record; defaults to today")
    .option("--import <file>", "Import a validated JSON array of historical daily counts");
  program.parse();
  const options = program.opts<{ source: string; date?: string; import?: string }>();
  const locality = process.env.LOCALITY?.trim();
  if (!locality) {
    throw new Error("LOCALITY is required for daily source counts");
  }
  const source = SOURCES.find((candidate) => {
    return candidate.id === options.source && candidate.localities.includes(locality);
  });
  if (!source) {
    throw new Error("Source is not configured for this locality");
  }

  const { getDb, closeDb } = await import("@/lib/db");
  const db = await getDb();
  try {
    if (options.import) {
      const contents = await readFile(resolve(options.import), "utf8");
      const input: unknown = JSON.parse(contents);
      const imported = await importSourceDailyCounts(db, input);
      logger.info("Imported source daily counts", { count: imported });
      return;
    }
    const date = options.date ?? getSofiaDateKey(new Date());
    const observation = await recordSourceDailyCount(db, {
      sourceType: source.id,
      locality,
      date,
    });
    if (!observation) {
      throw new Error(`No successful source snapshot available for ${date}`);
    }
    logger.info("Recorded source daily count", observation);
  } finally {
    await closeDb();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    logger.error("Source daily counts failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  });
}
