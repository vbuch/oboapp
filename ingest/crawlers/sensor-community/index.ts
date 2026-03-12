/**
 * sensor-community crawler — emergent (30-min interval).
 *
 * Reads raw PM readings from sensorCommunityReadings (stored by the fetch job),
 * groups them into ~4km grid cells, applies outlier filtering + NowCast AQI,
 * and triggers alerts when thresholds are breached.
 *
 * Blocker fixes from v2 review:
 * - #1: Non-overlapping halves [t-4h, t-2h) and [t-2h, now] for sustained alerts
 * - #2: windowTimestamp uses 30-min floor for deterministic dedup URLs
 * - #3: Sensor count ≥ MIN_SENSORS_PER_CELL checked AFTER outlier filtering
 */

import { logger } from "@/lib/logger";
import { getLocality } from "@/lib/target-locality";
import { getBoundsForLocality } from "@oboapp/shared";
import { saveSourceDocumentIfNew } from "../shared/firestore";
import type { SourceDocumentWithGeoJson } from "../shared/types";
import { buildGrid, assignToGridCell } from "@/lib/air-quality/grid";
import type { GridCell } from "@/lib/air-quality/grid";
import { filterOutliers } from "@/lib/air-quality/outlier-filter";
import type { SensorReading } from "@/lib/air-quality/outlier-filter";
import { calculateNowCastAqi, getAqiLabel } from "@/lib/air-quality/aqi";
import {
  SOURCE_TYPE,
  EVALUATION_WINDOW_HOURS,
  HALF_WINDOW_HOURS,
  AQI_IMMEDIATE_THRESHOLD,
  AQI_SUSTAINED_THRESHOLD,
  MIN_SENSORS_PER_CELL,
  MIN_HOUR_COVERAGE,
  DEDUP_WINDOW_MS,
} from "@/lib/air-quality/constants";

interface CellEvaluation {
  cell: GridCell;
  currentAqi: number;
  previousAqi: number;
  avgPm25: number;
  avgPm10: number;
  sensorCount: number;
  alertType: "immediate" | "sustained";
}

/**
 * Group readings by hourly bins and compute averages for NowCast.
 * Returns array of { pm25, pm10 } ordered most-recent first.
 */
function computeHourlyAverages(
  readings: SensorReading[],
): { pm25: number; pm10: number }[] {
  const hourBins = new Map<number, { pm25Sum: number; pm10Sum: number; count: number }>();

  for (const r of readings) {
    const hour = new Date(r.timestamp).getTime();
    const hourKey = Math.floor(hour / 3_600_000);
    const bin = hourBins.get(hourKey) ?? { pm25Sum: 0, pm10Sum: 0, count: 0 };
    bin.pm25Sum += r.p2;
    bin.pm10Sum += r.p1;
    bin.count++;
    hourBins.set(hourKey, bin);
  }

  return [...hourBins.entries()]
    .sort(([a], [b]) => b - a)// most recent first
    .map(([, bin]) => ({
      pm25: bin.pm25Sum / bin.count,
      pm10: bin.pm10Sum / bin.count,
    }));
}

/**
 * Compute average PM values from readings.
 */
function computeAverages(readings: SensorReading[]): { pm25: number; pm10: number } {
  if (readings.length === 0) return { pm25: 0, pm10: 0 };
  const pm25 = readings.reduce((sum, r) => sum + r.p2, 0) / readings.length;
  const pm10 = readings.reduce((sum, r) => sum + r.p1, 0) / readings.length;
  return { pm25, pm10 };
}

/**
 * Count unique sensors in a set of readings.
 */
function countUniqueSensors(readings: SensorReading[]): number {
  return new Set(readings.map((r) => r.sensorId)).size;
}

/**
 * Build the deterministic dedup URL for a grid cell alert.
 * Uses 30-min floor timestamp so the same evaluation window produces the same URL.
 */
function buildAlertUrl(
  locality: string,
  cellId: string,
  now: number = Date.now(),
): string {
  const windowTimestamp = Math.floor(now / DEDUP_WINDOW_MS) * DEDUP_WINDOW_MS;
  return `sensor-community://${locality}/${cellId}/${windowTimestamp}`;
}

/**
 * Build notification text with AQI, PM values, and sensor count.
 */
function buildAlertText(
  eval_: CellEvaluation,
): { text: string; markdownText: string } {
  const label = getAqiLabel(eval_.currentAqi);
  const pm25Str = eval_.avgPm25.toFixed(1);
  const pm10Str = eval_.avgPm10.toFixed(0);
  const sensorNote = `(по данни от ${eval_.sensorCount} сензора)`;
  const typeNote =
    eval_.alertType === "immediate"
      ? "Рязко влошаване"
      : "Продължително влошаване";

  const text =
    `${typeNote} на качеството на въздуха. ` +
    `Оценка на качеството на въздуха: ${eval_.currentAqi} (${label}). ` +
    `PM2.5: ${pm25Str} μg/m³, PM10: ${pm10Str} μg/m³. ${sensorNote}`;

  const markdownText =
    `**${typeNote}** на качеството на въздуха\n\n` +
    `- Оценка на качеството на въздуха: **${eval_.currentAqi}** (${label})\n` +
    `- PM2.5: ${pm25Str} μg/m³\n` +
    `- PM10: ${pm10Str} μg/m³\n` +
    `- ${sensorNote}`;

  return { text, markdownText };
}

export async function crawl(): Promise<void> {
  const locality = getLocality();
  const bounds = getBoundsForLocality(locality);
  const grid = buildGrid(bounds);

  logger.info(`[sensor-community] Starting crawl for ${locality}`, {
    gridCells: grid.length,
  });

  const { getDb } = await import("@/lib/db");
  const db = await getDb();

  const now = new Date();
  const windowStart = new Date(
    now.getTime() - EVALUATION_WINDOW_HOURS * 60 * 60 * 1000,
  );
  const halfPoint = new Date(
    now.getTime() - HALF_WINDOW_HOURS * 60 * 60 * 1000,
  );

  // Fetch all readings in the 4h evaluation window
  const rawReadings =
    await db.sensorCommunityReadings.findByLocalityAndTimeRange(
      locality,
      windowStart,
      now,
    );

  logger.info(`[sensor-community] Loaded ${rawReadings.length} readings`);

  if (rawReadings.length === 0) {
    logger.info("[sensor-community] No readings found, skipping");
    return;
  }

  // Group readings by grid cell
  const cellReadings = new Map<string, SensorReading[]>();
  for (const raw of rawReadings) {
    const reading: SensorReading = {
      sensorId: raw.sensorId as number,
      timestamp: new Date(raw.timestamp as string | number | Date),
      lat: raw.lat as number,
      lng: raw.lng as number,
      p1: raw.p1 as number,
      p2: raw.p2 as number,
    };

    const cell = assignToGridCell(grid, reading.lat, reading.lng);
    if (!cell) continue;

    const existing = cellReadings.get(cell.id) ?? [];
    existing.push(reading);
    cellReadings.set(cell.id, existing);
  }

  logger.info(
    `[sensor-community] Readings distributed across ${cellReadings.size} grid cells`,
  );

  let saved = 0;
  let skipped = 0;

  for (const [cellId, readings] of cellReadings) {
    const cell = grid.find((c) => c.id === cellId);
    if (!cell) continue;

    // Apply outlier filtering
    const filtered = filterOutliers(readings);

    // Blocker #3: Check sensor count AFTER filtering
    const sensorCount = countUniqueSensors(filtered);
    if (sensorCount < MIN_SENSORS_PER_CELL) {
      logger.info(`[sensor-community] Cell ${cellId}: ${sensorCount} sensors after filtering (min ${MIN_SENSORS_PER_CELL}), skipping`);
      continue;
    }

    // Split into non-overlapping halves (Blocker #1)
    const previousHalf = filtered.filter(
      (r) => r.timestamp >= windowStart && r.timestamp < halfPoint,
    );
    const currentHalf = filtered.filter((r) => r.timestamp >= halfPoint);

    if (currentHalf.length === 0) continue;

    // Check hourly bin sparsity
    const currentHourly = computeHourlyAverages(currentHalf);
    const expectedHours = HALF_WINDOW_HOURS;
    if (currentHourly.length / expectedHours < MIN_HOUR_COVERAGE) {
      logger.info(
        `[sensor-community] Cell ${cellId}: only ${currentHourly.length}/${expectedHours} hours with data, skipping`,
      );
      continue;
    }

    const currentAqi = calculateNowCastAqi(currentHourly);

    // Determine alert type
    let alertType: "immediate" | "sustained" | null = null;

    if (currentAqi >= AQI_IMMEDIATE_THRESHOLD) {
      alertType = "immediate";
    } else if (currentAqi >= AQI_SUSTAINED_THRESHOLD) {
      // Need previous half to also exceed sustained threshold
      const previousHourly = computeHourlyAverages(previousHalf);
      if (previousHourly.length > 0) {
        const previousAqi = calculateNowCastAqi(previousHourly);
        if (previousAqi >= AQI_SUSTAINED_THRESHOLD) {
          alertType = "sustained";
        }
      }
    }

    if (!alertType) continue;

    const previousHourly = computeHourlyAverages(previousHalf);
    const previousAqi =
      previousHourly.length > 0
        ? calculateNowCastAqi(previousHourly)
        : 0;
    const { pm25: avgPm25, pm10: avgPm10 } = computeAverages(currentHalf);

    const evaluation: CellEvaluation = {
      cell,
      currentAqi,
      previousAqi,
      avgPm25,
      avgPm10,
      sensorCount,
      alertType,
    };

    const url = buildAlertUrl(locality, cellId);
    const { text, markdownText } = buildAlertText(evaluation);

    const doc: SourceDocumentWithGeoJson = {
      url,
      deepLinkUrl: "",
      datePublished: now.toISOString(),
      title: `Влошено качество на въздуха – ${cellId}`,
      message: text,
      markdownText,
      sourceType: SOURCE_TYPE,
      locality,
      crawledAt: new Date(),
      geoJson: JSON.stringify(cell.geoJson),
      categories: ["air-quality"],
      isRelevant: true,
      timespanStart: halfPoint,
      timespanEnd: now,
    };

    try {
      const didSave = await saveSourceDocumentIfNew(doc, db);
      if (didSave) {
        logger.info(`[sensor-community] Alert saved for cell ${cellId}`, {
          alertType,
          aqi: currentAqi,
          sensorCount,
        });
        saved++;
      } else {
        skipped++;
      }
    } catch (error) {
      logger.error(`[sensor-community] Failed to save alert for cell ${cellId}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info(
    `[sensor-community] Done: ${saved} alerts saved, ${skipped} deduped`,
  );
}
