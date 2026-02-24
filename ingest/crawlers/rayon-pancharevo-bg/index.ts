#!/usr/bin/env node

import dotenv from "dotenv";
import { resolve } from "node:path";
import type { OboDb } from "@oboapp/db";
import { extractPostLinks, extractPostDetails } from "./extractors";
import { buildWebPageSourceDocument } from "../shared/webpage-crawlers";
import { saveSourceDocumentIfNew } from "../shared/firestore";
import { logger } from "@/lib/logger";

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const INDEX_URL =
  "https://www.pancharevo.org/%D1%80%D0%B5%D0%BC%D0%BE%D0%BD%D1%82%D0%B8-%D0%B8-%D0%B8%D0%BD%D1%84%D1%80%D0%B0%D1%81%D1%82%D1%80%D1%83%D0%BA%D1%82%D1%83%D1%80%D0%B0";
const SOURCE_TYPE = "rayon-pancharevo-bg";
const LOCALITY = "bg.sofia";
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds

// Local date parsing to handle multiple Bulgarian formats and ranges
function parseBulgarianDateOrRangeLocal(text?: string): { start?: Date; end?: Date } | null {
  if (!text) return null;
  const t = text.trim();
  // Bulgarian month names
  const months: Record<string, number> = {
    януари: 0,
    февруари: 1,
    март: 2,
    април: 3,
    май: 4,
    юни: 5,
    юли: 6,
    август: 7,
    септември: 8,
    октомври: 9,
    ноември: 10,
    декември: 11,
  };

  // Normalize - replace multiple spaces and remove day-of-week in parentheses
  const cleaned = t.replace(/\s+/g, " ").replace(/\([^)]*\)/g, "").trim();

  // 1) Pattern: 27 януари 2026 or 27 януари
  const singleMonthRe = /(?<day>\d{1,2})\s+(?<month>[\p{L}]+)\s*(?<year>\d{4})?/u;
  const m1 = cleaned.match(singleMonthRe);
  if (m1 && m1.groups) {
    const day = Number(m1.groups.day);
    const monthName = m1.groups.month.toLowerCase();
    const year = m1.groups.year ? Number(m1.groups.year) : new Date().getFullYear();
    const month = months[monthName];
    if (month !== undefined) {
      const start = new Date(Date.UTC(year, month, day));
      return { start, end: start };
    }
  }

  // 2) Range pattern: 15-19.03.2021  -> startDay-endDay.month.year
  const rangeA = cleaned.match(/(?<start>\d{1,2})-(?<end>\d{1,2})\.(?<month>\d{1,2})\.(?<year>\d{4})/);
  if (rangeA && rangeA.groups) {
    const year = Number(rangeA.groups.year);
    const month = Number(rangeA.groups.month) - 1;
    const start = new Date(Date.UTC(year, month, Number(rangeA.groups.start)));
    const end = new Date(Date.UTC(year, month, Number(rangeA.groups.end)));
    return { start, end };
  }

  // 3) Range pattern: 15.02-19.03.2021 -> startDay.startMonth - endDay.endMonth.year
  const rangeB = cleaned.match(/(?<sday>\d{1,2})\.(?<smonth>\d{1,2})-(?<eday>\d{1,2})\.(?<emonth>\d{1,2})\.(?<year>\d{4})/);
  if (rangeB && rangeB.groups) {
    const year = Number(rangeB.groups.year);
    const start = new Date(Date.UTC(year, Number(rangeB.groups.smonth) - 1, Number(rangeB.groups.sday)));
    const end = new Date(Date.UTC(year, Number(rangeB.groups.emonth) - 1, Number(rangeB.groups.eday)));
    return { start, end };
  }

  // 4) Try numeric dates with dots: 15.03.2021 or 15.02.2021-19.03.2021
  const simpleDotRange = cleaned.match(/(?<s>\d{1,2}\.\d{1,2}\.\d{4})\s*-\s*(?<e>\d{1,2}\.\d{1,2}\.\d{4})/);
  if (simpleDotRange && simpleDotRange.groups) {
    const parseDot = (v: string) => {
      const [d, m, y] = v.split(".").map(Number);
      return new Date(Date.UTC(y, m - 1, d));
    };
    return { start: parseDot(simpleDotRange.groups.s), end: parseDot(simpleDotRange.groups.e) };
  }

  // If nothing matched, return null
  return null;
}

function isDateRelevantLocal(range: { start?: Date; end?: Date } | null): boolean {
  if (!range) return false;
  const today = new Date();
  // Normalize to UTC midnight for comparisons
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const end = range.end ? Date.UTC(range.end.getUTCFullYear(), range.end.getUTCMonth(), range.end.getUTCDate()) : undefined;
  const start = range.start ? Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), range.start.getUTCDate()) : undefined;
  if (end !== undefined) return end >= now;
  if (start !== undefined) return start >= now;
  return false;
}
/**
 * Try to extract the village/settlement name from an opened post page
 */
async function extractSettlementFromPage(page: { evaluate: (fn: () => Promise<string | undefined> | string | undefined) => Promise<string | undefined> }) {
  // Use page.evaluate to inspect DOM and look for common patterns
  // Return the first plausible settlement string or undefined
  try {
    const v = await page.evaluate(() => {

      // Search for labels mentioning "Населено място" or "Населено"
      const labelEl = Array.from(document.querySelectorAll("p, div, span, li, strong, b"))
        .find((el) => /населен/i.test(el.textContent || ""));
      if (labelEl) {
        // Look for sibling text
        const next = labelEl.nextElementSibling as Element | null;
        if (next && next.textContent && next.textContent.trim().length > 0) return next.textContent.trim();
        const parent = labelEl.parentElement;
        if (parent) {
          const t = parent.textContent?.replace(/\s+/g, " ").trim();
          // Attempt to remove the label itself
          return t?.replace(/.*населен[а-яА-Я\s:,-]*/i, "").trim();
        }
      }

      // Fallback: look for abbreviations like "с. " or "гр. " inside the article
      const container = document.querySelector("article, .entry-content, .post-content, main, body");
      const ctext = container?.textContent || document.body.textContent || "";
      const m = ctext.match(/\bс\.\s*([А-Яа-яЁё\- ]{2,50})/i);
      if (m) return m[1].trim();

      const m2 = ctext.match(/\bгр\.\s*([А-Яа-яЁё\- ]{2,50})/i);
      if (m2) return m2[1].trim();

      return undefined;
    });

    return typeof v === "string" && v.length > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Main crawler function with pagination and date filtering
 * Stops early when finding 5 consecutive outdated articles
 */
export async function crawl(): Promise<void> {
  // Support dry-run mode which skips DB initialization and saves.
  let db: OboDb | null = null;
  if (process.env.DRY_RUN !== "true") {
    const { getDb } = await import("@/lib/db");
    db = await getDb();
  }

  const { launchBrowser } = await import("../shared/browser");
  const { delay } = await import("@/lib/delay");

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    let url = INDEX_URL;
    let pageCount = 0;
    let consecutivePastCount = 0;

    // Extract settlements (Населени места) from the menu/dropdown on the index
    let settlementsList: string[] = [];
    try {
      await page.goto(INDEX_URL, { waitUntil: "networkidle" });

      settlementsList = await page.evaluate(async () => {
        const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

        // Find element that likely opens "Населени места" menu
        const candidates = Array.from(document.querySelectorAll<HTMLElement>("a, button, span, li"))
          .filter((el) => (el.textContent || "").toLowerCase().includes("населен"));

        if (candidates.length === 0) return [];

        const trigger = candidates[0];
        // If trigger is clickable, try to click it to reveal dropdown
        try {
          (trigger as HTMLElement).click();
        } catch {
          // ignore
        }

        // Wait briefly for dropdown to render
        await new Promise((res) => setTimeout(res, 300));

        // Look for anchor elements near the trigger (siblings, parent, nav)
        const parent = trigger.closest("nav") || trigger.parentElement || document.body;
        const anchors = Array.from(parent.querySelectorAll("a"))
          .map((a) => a.textContent || "")
          .map(normalize)
          .filter((t) => t.length > 0 && !/^(дом|начало|контакти|about|служби)$/i.test(t));

        return Array.from(new Set(anchors));
      });

      logger.info("Settlements extracted from menu", { count: settlementsList.length });
    } catch (err) {
      logger.warn("Failed to extract settlements dropdown", { error: err instanceof Error ? err.message : String(err) });
    }

    while (url) {
      pageCount++;
      logger.info("Crawling page", { pageNum: pageCount, url });
      await page.goto(url, { waitUntil: "networkidle" });

      const postLinks = await extractPostLinks(page);
      logger.info("Found posts on page", { count: postLinks.length });

      if (postLinks.length === 0) {
        break;
      }

      for (const postLink of postLinks) {
        // Always open the detail page and extract data from there (requirement)
        const detailPage = await browser.newPage();
        try {
          await detailPage.goto(postLink.url, { waitUntil: "networkidle" });
          const details = await extractPostDetails(detailPage);

          // Parse date strictly from details.dateText (requirement)
          const parsed = parseBulgarianDateOrRangeLocal(details.dateText || details.title || "");
          if (!isDateRelevantLocal(parsed)) {
            consecutivePastCount++;
            logger.info("Skipping past article", { title: (details.title || postLink.title).substring(0, 60), consecutiveCount: consecutivePastCount });
            if (consecutivePastCount >= 5) {
              logger.info("Stopping crawl: found 5 consecutive outdated articles", { threshold: 5 });
              url = "";
              break;
            }
            continue;
          }

          // Reset counter when we find a current/future article
          consecutivePastCount = 0;

          // Extract settlement/village from the detail page
          const settlement = await extractSettlementFromPage(detailPage);
          if (settlement && settlementsList.length && !settlementsList.some((s) => s.includes(settlement) || settlement.includes(s))) {
            logger.warn("Extracted settlement not present in menu list", { settlement, knownCount: settlementsList.length });
          }

          try {
            // Build source document and save if new
            const postDetails = buildWebPageSourceDocument({
              url: postLink.url,
              title: details.title,
              dateText: details.dateText,
              contentHtml: details.contentHtml,
              sourceType: SOURCE_TYPE,
              locality: LOCALITY,
              customDateParser: (dt: string) => {
                const p = parseBulgarianDateOrRangeLocal(dt);
                if (p && p.start) return p.start.toISOString();
                // fallback: if date can't be parsed, return today's ISO date
                return new Date().toISOString();
              },
            });

            const sourceDoc: Record<string, unknown> = { ...postDetails, crawledAt: new Date() };
            if (settlement) sourceDoc.settlement = settlement;

            if (process.env.DRY_RUN === "true") {
              logger.info("DRY_RUN: would save document", { url: postLink.url, title: details.title.substring(0, 50) });
            } else {
              const saved = await saveSourceDocumentIfNew(sourceDoc as Record<string, unknown>, db, { logSuccess: true });
              if (!saved) {
                logger.info("Skipped duplicate article", { title: details.title.substring(0, 50) });
              }
            }
          } catch (err) {
            logger.error("Failed to build or save source document", {
              url: postLink.url,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        } finally {
          await detailPage.close();
        }

        // Respect rate limiting
        await delay(DELAY_BETWEEN_REQUESTS);
      }

      // Break if we hit the early stopping threshold
      if (consecutivePastCount >= 5) {
        break;
      }

      // Find next page link
      const nextHref: string | null = await page.evaluate(() => {
        const rel = document.querySelector<HTMLAnchorElement>('a[rel="next"]');
        if (rel && rel.href) return rel.href;
        const next = document.querySelector<HTMLAnchorElement>(".pagination a.next, a.next");
        if (next && next.href) return next.href;
        const pagLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(".pagination a, nav a, .pagination li a"));
        for (const a of pagLinks) {
          const t = a.textContent?.trim();
          if (!t) continue;
          if (/Следващ|Следваща|Next|›|»|>/.test(t)) return a.href;
        }
        return null;
      });

      if (nextHref) {
        url = new URL(nextHref, url).href;
        logger.info("Found next page", { url });
      } else {
        url = "";
      }
    }

    await page.close();
    logger.info("Crawling completed", { pagesProcessed: pageCount });
  } finally {
    await browser.close();
  }
}

// Run the crawler if executed directly
if (require.main === module) {
  crawl().catch((error) => {
    logger.error("Fatal error", { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  });
}
