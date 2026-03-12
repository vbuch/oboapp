#!/usr/bin/env node

/**
 * Air quality fetch job.
 *
 * Standalone entry point that runs every 15 minutes via Cloud Scheduler.
 * Fetches raw PM2.5/PM10 readings from sensor.community API,
 * stores them in sensorCommunityReadings, and cleans up old data.
 */

import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

import { logger } from "@/lib/logger";
import { getLocality } from "@/lib/target-locality";
import { getBoundsForLocality } from "@oboapp/shared";
import { parseSensorResponse } from "@/lib/air-quality/parse-sensor-response";
import {
  SENSOR_COMMUNITY_API_URL,
  DATA_RETENTION_HOURS,
} from "@/lib/air-quality/constants";

async function main() {
  const locality = getLocality();
  const bounds = getBoundsForLocality(locality);
  const apiUrl = `${SENSOR_COMMUNITY_API_URL}${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;

  logger.info(`[air-quality-fetch] Fetching sensor.community data for ${locality}`);
  logger.info(`[air-quality-fetch] API URL: ${apiUrl}`);

  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(
      `sensor.community API returned ${response.status}: ${response.statusText}`,
    );
  }

  const apiData = (await response.json()) as unknown[];
  logger.info(`[air-quality-fetch] Received ${apiData.length} raw entries`);

  const readings = parseSensorResponse(apiData, locality);
  logger.info(`[air-quality-fetch] Parsed ${readings.length} valid readings`);

  const { getDb } = await import("@/lib/db");
  const db = await getDb();

  let stored = 0;
  let skipped = 0;

  for (const reading of readings) {
    const id = `${reading.sensorId}_${reading.timestamp.toISOString()}`;
    try {
      await db.sensorCommunityReadings.createOne(id, {
        sensorId: reading.sensorId,
        sensorType: reading.sensorType,
        timestamp: reading.timestamp,
        fetchedAt: new Date(),
        lat: reading.lat,
        lng: reading.lng,
        p1: reading.p1,
        p2: reading.p2,
        locality,
      });
      stored++;
    } catch {
      // createOne fails if ID already exists — expected dedup behavior
      skipped++;
    }
  }

  // Clean up readings older than retention period
  const cutoff = new Date(Date.now() - DATA_RETENTION_HOURS * 60 * 60 * 1000);
  const cleaned = await db.sensorCommunityReadings.deleteOlderThan(cutoff);

  logger.info(
    `[air-quality-fetch] Done: ${stored} stored, ${skipped} skipped (dedup), ${cleaned} cleaned`,
  );

  await db.close();
}

main().catch((err) => {
  logger.error("[air-quality-fetch] Fatal error:", err);
  process.exit(1);
});
