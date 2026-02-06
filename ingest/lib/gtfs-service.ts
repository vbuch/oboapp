import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import { adminDb } from "./firebase-admin";
import { isWithinSofia } from "./bounds";
import { roundCoordinate } from "../crawlers/shared/coordinate-utils";
import { logger } from "@/lib/logger";

const GTFS_URL = "https://gtfs.sofiatraffic.bg/api/v1/static";
const BATCH_SIZE = 100;

export interface GTFSStop {
  stopCode: string;
  stopName: string;
  lat: number;
  lng: number;
}

/**
 * Download and extract GTFS ZIP file, returning stops.txt content
 */
async function downloadAndExtractGTFS(): Promise<string> {
  logger.info("Downloading GTFS data", { url: GTFS_URL });

  const response = await fetch(GTFS_URL);

  if (!response.ok) {
    throw new Error(
      `Failed to download GTFS: ${response.status} ${response.statusText}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  logger.info("Extracting stops.txt from ZIP archive");
  const zip = new AdmZip(buffer);
  const stopsEntry = zip.getEntry("stops.txt");

  if (!stopsEntry) {
    throw new Error("stops.txt not found in GTFS archive");
  }

  return stopsEntry.getData().toString("utf-8");
}

/**
 * Parse stops.txt CSV content into GTFSStop objects
 * Validates coordinates are within Sofia and rounds to 6 decimals
 */
export function parseStopsFile(csvContent: string): GTFSStop[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const stops: GTFSStop[] = [];
  let skippedOutOfBounds = 0;
  let skippedNoCode = 0;

  for (const record of records) {
    const stopCode = record.stop_code?.trim();
    const stopName = record.stop_name?.trim();
    const lat = Number.parseFloat(record.stop_lat);
    const lng = Number.parseFloat(record.stop_lon);

    // Skip stops without a stop_code
    if (!stopCode) {
      skippedNoCode++;
      continue;
    }

    // Validate coordinates
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      logger.warn("Invalid coordinates for stop", { stopCode, lat: record.stop_lat, lng: record.stop_lon });
      continue;
    }

    // Validate within Sofia boundaries
    if (!isWithinSofia(lat, lng)) {
      skippedOutOfBounds++;
      continue;
    }

    stops.push({
      stopCode,
      stopName: stopName || stopCode,
      lat: roundCoordinate(lat),
      lng: roundCoordinate(lng),
    });
  }

  if (skippedNoCode > 0) {
    logger.info("Skipped stops without stop_code", { count: skippedNoCode });
  }
  if (skippedOutOfBounds > 0) {
    logger.info("Skipped stops outside Sofia boundaries", { count: skippedOutOfBounds });
  }

  return stops;
}

/**
 * Sync GTFS stops to Firestore in batches
 * Uses upsert (set with merge) to update existing records
 */
export async function syncGTFSStopsToFirestore(): Promise<void> {
  logger.info("Starting GTFS stops sync");

  const csvContent = await downloadAndExtractGTFS();
  const stops = parseStopsFile(csvContent);

  logger.info("Parsed valid stops", { count: stops.length });

  // Batch write to Firestore
  const db = adminDb;
  const stopsCollection = db.collection("gtfsStops");

  let written = 0;
  for (let i = 0; i < stops.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = stops.slice(i, i + BATCH_SIZE);

    for (const stop of chunk) {
      const docRef = stopsCollection.doc(stop.stopCode);
      batch.set(
        docRef,
        {
          stopCode: stop.stopCode,
          stopName: stop.stopName,
          coordinates: {
            latitude: stop.lat,
            longitude: stop.lng,
          },
          lastUpdated: new Date(),
        },
        { merge: true },
      );
    }

    await batch.commit();
    written += chunk.length;
    logger.info("Wrote GTFS batch", { batch: Math.floor(i / BATCH_SIZE) + 1, written, total: stops.length });
  }

  logger.info("Successfully synced bus stops to Firestore", { count: written });
}
