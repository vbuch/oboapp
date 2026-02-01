#!/usr/bin/env node
import dotenv from "dotenv";
import { resolve } from "node:path";
import { parseIncidents } from "./parser";
import { buildMessage, buildUrl, buildTitle } from "./builders";
import { launchBrowser } from "../shared/browser";
import { saveSourceDocumentIfNew } from "../shared/firestore";
import type { SourceDocumentWithGeoJson } from "../shared/types";
import { validateTimespanRange } from "@/lib/timespan-utils";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const SOURCE_TYPE = "toplo-bg";
const TARGET_URL = "https://toplo.bg/accidents-and-maintenance";

interface ToploBgSourceDocument extends SourceDocumentWithGeoJson {
  sourceType: typeof SOURCE_TYPE;
}

type SourceDocument = ToploBgSourceDocument;

interface CrawlSummary {
  saved: number;
  skipped: number;
  failed: number;
}

export async function crawl(dryRun = false): Promise<void> {
  const summary: CrawlSummary = { saved: 0, skipped: 0, failed: 0 };

  console.log(`🔥 Fetching incidents from ${TARGET_URL}...`);

  // Launch browser and fetch HTML
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(TARGET_URL, { waitUntil: "networkidle" });
  const html = await page.content();
  await browser.close();

  console.log(`📄 Parsing incidents...`);

  // Parse incidents from HTML
  const incidents = parseIncidents(html);

  if (incidents.length === 0) {
    console.error("❌ No incidents found in HTML");
    process.exit(1);
  }

  console.log(`📊 Found ${incidents.length} incidents`);

  // Load Firebase Admin (lazy)
  const adminDb = dryRun
    ? null
    : (await import("@/lib/firebase-admin")).adminDb;

  // Process each incident
  for (const incident of incidents) {
    try {
      const { info, geoJson } = incident;

      const message = buildMessage(
        info.Name,
        info.FromDate,
        info.Addresses,
        info.UntilDate,
      );

      // Extract timespans from incident info
      let timespanStart: Date;
      let timespanEnd: Date;

      try {
        const parsed = new Date(info.FromDate);
        if (validateTimespanRange(parsed)) {
          timespanStart = parsed;
        } else {
          console.warn(
            `   ⚠️  FromDate outside valid range for ${info.ContentItemId}: ${info.FromDate}`,
          );
          timespanStart = new Date();
        }
      } catch (error) {
        console.warn(
          `   ⚠️  Invalid FromDate for ${info.ContentItemId}: ${info.FromDate} - ${error}`,
        );
        timespanStart = new Date();
      }

      try {
        // UntilDate can be null
        if (info.UntilDate) {
          const parsed = new Date(info.UntilDate);
          if (validateTimespanRange(parsed)) {
            timespanEnd = parsed;
          } else {
            console.warn(
              `   ⚠️  UntilDate outside valid range for ${info.ContentItemId}: ${info.UntilDate}`,
            );
            timespanEnd = timespanStart;
          }
        } else {
          timespanEnd = timespanStart; // Use start date for both
        }
      } catch (error) {
        console.warn(
          `   ⚠️  Invalid UntilDate for ${info.ContentItemId}: ${info.UntilDate} - ${error}`,
        );
        timespanEnd = timespanStart;
      }

      const doc: SourceDocument = {
        url: buildUrl(info.ContentItemId),
        datePublished: info.FromDate,
        title: buildTitle(info),
        message,
        markdownText: message, // Store for display in details view
        sourceType: SOURCE_TYPE,
        crawledAt: new Date(),
        geoJson,
        categories: ["heating"],
        isRelevant: true,
        timespanStart,
        timespanEnd,
      };

      if (dryRun) {
        console.log(`📝 [dry-run] ${doc.title}`);
        summary.saved++;
      } else if (adminDb) {
        const saved = await saveSourceDocumentIfNew(doc, adminDb, {
          transformData: (d) => ({
            ...d,
            geoJson: JSON.stringify(d.geoJson),
            crawledAt: new Date(d.crawledAt),
          }),
          logSuccess: false,
        });
        if (saved) {
          console.log(`✅ Saved: ${doc.title}`);
          summary.saved++;
        } else {
          summary.skipped++;
        }
      }
    } catch (error) {
      console.warn(`⚠️  Failed to process incident:`, error);
      summary.failed++;
    }
  }

  // Print summary
  console.log(
    `\n📈 Saved: ${summary.saved}; Skipped: ${summary.skipped}; Failed: ${summary.failed}`,
  );

  // Exit with error if all failed
  if (summary.failed > 0 && summary.saved === 0 && summary.skipped === 0) {
    console.error("\n❌ All incidents failed to process");
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  crawl(false).catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
