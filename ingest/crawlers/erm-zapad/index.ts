#!/usr/bin/env node
import { resolve } from "node:path";
import dotenv from "dotenv";
import { delay } from "@/lib/delay";
import { validateAndFixGeoJSON } from "../shared/geojson-validation";
import { launchBrowser } from "../shared/browser";
import { saveSourceDocumentIfNew } from "../shared/firestore";
import { parseBulgarianDateTime } from "../shared/date-utils";
import { buildGeoJSON, buildMessage, buildTitle } from "./builders";
import { extractPinRecords } from "./extractors";
import { deduplicatePinRecords } from "./deduplication";
import { parseTimespans } from "./timespan-parsing";
import { groupPinsByEventId } from "./grouping";
import type {
  ApiResponse,
  CrawlSummary,
  ErmZapadSourceDocument,
  Municipality,
  PinRecord,
  RawIncident,
} from "./types";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const BASE_URL = "https://info.ermzapad.bg";
const INDEX_URL = `${BASE_URL}/webint/vok/avplan.php`;
const API_URL = INDEX_URL;
const SOURCE_TYPE = "erm-zapad";

/**
 * Discover active София-град municipalities from the index page
 */
async function discoverMunicipalities(): Promise<Municipality[]> {
  console.log("🔍 Discovering София-град municipalities...");

  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    await page.goto(INDEX_URL, { waitUntil: "networkidle" });

    const municipalities = await page.evaluate(() => {
      const results: Municipality[] = [];

      // Find the Sofia-City region card
      const headers = Array.from(document.querySelectorAll("h5.card-title"));
      const sofiaHeader = headers.find((h) =>
        h.textContent?.includes("Област София-град"),
      );

      if (!sofiaHeader) {
        return results;
      }

      // Get the parent card-body
      const cardBody = sofiaHeader.closest("div.card-body");
      if (!cardBody) {
        return results;
      }

      // Find all municipality list items
      const listItems = cardBody.querySelectorAll("ul.list-group li");

      listItems.forEach((li) => {
        const onclick = li.getAttribute("onclick");
        if (!onclick) return;

        // Extract municipality code from onclick="show_obstina('SOF16','SOF'); ..."
        const match = /show_obstina\('([^']+)'/.exec(onclick);
        if (!match) return;

        const code = match[1];

        // Extract municipality name from text content
        const text = li.textContent?.trim() || "";
        // Format: "  община ПАНЧАРЕВО" or "  община КРАСНО СЕЛО" - extract just the name
        const nameMatch = /община\s+(.+)/i.exec(text);
        const name = nameMatch ? nameMatch[1].trim() : text;

        if (code && name) {
          results.push({ code, name });
        }
      });

      return results;
    });

    console.log(`   ✅ Found ${municipalities.length} municipalities`);
    municipalities.forEach((m) => console.log(`      • ${m.code}: ${m.name}`));

    return municipalities;
  } finally {
    await browser.close();
  }
}

/**
 * Fetch incidents for a specific municipality
 */
async function fetchMunicipalityIncidents(
  code: string,
): Promise<RawIncident[]> {
  const formData = new URLSearchParams({
    action: "draw",
    gm_obstina: code,
    lat: "0",
    lon: "0",
  });

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch incidents for ${code}: ${response.status} ${response.statusText}`,
    );
  }

  const data: ApiResponse = await response.json();

  // Convert object to array of incidents
  const incidents: RawIncident[] = [];
  for (const [, incident] of Object.entries(data)) {
    if (incident && typeof incident === "object") {
      incidents.push(incident);
    }
  }

  return incidents;
}

/**
 * Convert pins for the same incident to a single source document
 */
function buildSourceDocument(pins: PinRecord[]): ErmZapadSourceDocument | null {
  if (pins.length === 0) {
    console.warn(`   ⚠️  Skipping empty pin array`);
    return null;
  }

  // Use first pin for metadata (all pins from same incident share these fields)
  const pin = pins[0];

  // Validate required fields
  if (!pin.eventId || typeof pin.eventId !== "string") {
    console.warn(`   ⚠️  Skipping pin without eventId`);
    return null;
  }

  // Build GeoJSON with all pins for this incident
  const geoJson = buildGeoJSON(pins);
  if (!geoJson) {
    console.warn(`   ⚠️  Skipping incident without geometry: ${pin.eventId}`);
    return null;
  }

  // Validate and fix GeoJSON
  const validation = validateAndFixGeoJSON(geoJson, pin.eventId);
  if (!validation.isValid || !validation.geoJson) {
    console.warn(`   ⚠️  Invalid GeoJSON for ${pin.eventId}:`);
    validation.errors.forEach((err) => console.warn(`      ${err}`));
    return null;
  }

  // Log any coordinate fixes
  if (validation.warnings.length > 0) {
    console.warn(`   ⚠️  Fixed GeoJSON for ${pin.eventId}:`);
    validation.warnings.forEach((warn) => console.warn(`      ${warn}`));
  }

  const url = `${BASE_URL}/incidents/${pin.eventId}`;
  const title = buildTitle(pin);
  const message = buildMessage(pin);

  // Use pin start time as published date, fallback to current time
  let datePublished = new Date().toISOString();
  if (pin.begin_event) {
    try {
      datePublished = parseBulgarianDateTime(pin.begin_event).toISOString();
    } catch {
      console.warn(
        `   ⚠️  Invalid date format for ${pin.eventId}: ${pin.begin_event}`,
      );
    }
  }

  const { timespanStart, timespanEnd } = parseTimespans(pin);

  return {
    url,
    datePublished,
    title,
    message,
    markdownText: message,
    sourceType: SOURCE_TYPE,
    crawledAt: new Date(),
    geoJson: JSON.stringify(validation.geoJson),
    categories: ["electricity"],
    isRelevant: true,
    timespanStart,
    timespanEnd,
  };
}

/**
 * Process incidents for a municipality and return pin records
 */
async function processMunicipality(
  municipality: Municipality,
): Promise<PinRecord[]> {
  console.log(`\n📍 Processing ${municipality.name} (${municipality.code})...`);

  try {
    const incidents = await fetchMunicipalityIncidents(municipality.code);
    console.log(`   Found ${incidents.length} incident(s)`);

    if (incidents.length === 0) {
      return [];
    }

    // Extract pin records from all incidents
    const allPins: PinRecord[] = [];
    for (const incident of incidents) {
      const pins = extractPinRecords(incident);
      allPins.push(...pins);
    }

    console.log(`   Extracted ${allPins.length} pin(s)`);
    return allPins;
  } catch (error) {
    console.error(
      `   ❌ Failed to fetch incidents for ${municipality.code}:`,
      error,
    );
    throw error; // Re-throw to fail the crawl
  }
}

/**
 * Save incidents to Firestore and update summary
 */
async function saveIncidents(
  incidentMap: Map<string, PinRecord[]>,
  adminDb: FirebaseFirestore.Firestore,
  summary: CrawlSummary,
): Promise<void> {
  for (const [eventId, pins] of incidentMap) {
    try {
      const doc = buildSourceDocument(pins);
      if (!doc) {
        summary.skipped++;
        continue;
      }

      const saved = await saveSourceDocumentIfNew(doc, adminDb);
      if (saved) {
        console.log(`   ✅ Saved: ${doc.title} (${pins.length} pin(s))`);
        summary.saved++;
      } else {
        summary.skipped++;
      }
    } catch (error) {
      console.error(`   ❌ Failed to process incident ${eventId}:`, error);
      summary.failed++;
    }
  }
}

/**
 * Main crawler function
 */
async function crawl(): Promise<void> {
  console.log("🚀 Starting ERM-Zapad crawler...\n");

  const startTime = Date.now();
  const totalSummary: CrawlSummary = { saved: 0, skipped: 0, failed: 0 };

  try {
    // Discover municipalities
    const municipalities = await discoverMunicipalities();

    if (municipalities.length === 0) {
      console.log("⚠️  No София-град municipalities found");
      return;
    }

    // Collect all pins from all municipalities
    const allPins: PinRecord[] = [];
    for (const municipality of municipalities) {
      const pins = await processMunicipality(municipality);
      allPins.push(...pins);

      // Delay between municipalities
      if (municipality !== municipalities.at(-1)) {
        await delay(2000); // 2 second delay
      }
    }

    console.log(`\n📊 Total pins extracted: ${allPins.length}`);

    // Deduplicate globally across all municipalities
    const uniquePins = deduplicatePinRecords(allPins);
    console.log(
      `📊 Unique pins after deduplication: ${uniquePins.length} (removed ${allPins.length - uniquePins.length} duplicates)`,
    );

    // Group pins by eventId to handle potential duplicates across municipalities
    const incidentMap = groupPinsByEventId(uniquePins);

    console.log(
      `📊 Incidents after grouping: ${incidentMap.size} (${uniquePins.length} total pins)`,
    );

    // Dynamic import after dotenv.config
    const { adminDb } = await import("@/lib/firebase-admin");

    // Save all incidents
    await saveIncidents(incidentMap, adminDb, totalSummary);

    // Final summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `\n✅ Crawl complete in ${duration}s. Saved: ${totalSummary.saved}; Skipped: ${totalSummary.skipped}; Failed: ${totalSummary.failed}`,
    );

    // Exit with error if all failed
    if (
      totalSummary.failed > 0 &&
      totalSummary.saved === 0 &&
      totalSummary.skipped === 0
    ) {
      console.error("\n❌ All pins failed to process");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Crawl failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  void crawl();
}

export { crawl };
