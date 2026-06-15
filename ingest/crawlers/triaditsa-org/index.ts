#!/usr/bin/env node

import dotenv from "dotenv";
import { resolve } from "node:path";
import type { OboDb } from "@oboapp/db";
import type { RssFeedItem } from "../shared/rss";
import { fetchFeedXml } from "../shared/rss";
import { extractFeedItems } from "./extractors";
import { buildWebPageSourceDocument } from "../shared/webpage-crawlers";
import { isUrlProcessed, saveSourceDocument } from "../shared/firestore";
import { logger } from "@/lib/logger";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const FEED_URL =
  "https://triaditza.org/category/%D0%BD%D0%BE%D0%B2%D0%B8%D0%BD%D0%B8-%D0%B8-%D1%81%D1%8A%D0%B1%D0%B8%D1%82%D0%B8%D1%8F/feed/";
const SOURCE_TYPE = "triaditsa-org";
const LOCALITY = "bg.sofia";

export async function crawl(): Promise<void> {
  const { getDb } = await import("@/lib/db");
  const db = await getDb();

  logger.info("Starting crawler", { sourceType: SOURCE_TYPE });

  let feedItems: RssFeedItem[];
  try {
    const xml = await fetchFeedXml(FEED_URL);
    feedItems = extractFeedItems(xml);
  } catch (error) {
    logger.error("Failed to fetch or parse RSS feed", {
      sourceType: SOURCE_TYPE,
      feedUrl: FEED_URL,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  if (feedItems.length === 0) {
    logger.warn("No posts found in RSS feed", { sourceType: SOURCE_TYPE });
    return;
  }

  const seen = new Set<string>();
  const uniqueItems = feedItems.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  logger.info("Fetched RSS feed", {
    sourceType: SOURCE_TYPE,
    feedUrl: FEED_URL,
    count: uniqueItems.length,
  });

  const newItems = await filterUnprocessed(uniqueItems, db);
  const skipped = uniqueItems.length - newItems.length;

  if (newItems.length === 0) {
    logger.info("Crawl complete", {
      sourceType: SOURCE_TYPE,
      total: uniqueItems.length,
      saved: 0,
      skipped,
      failed: 0,
    });
    return;
  }

  let saved = 0;
  let failed = 0;

  for (const item of newItems) {
    try {
      const doc = buildWebPageSourceDocument({
        url: item.url,
        title: item.title,
        dateText: item.date,
        contentHtml: item.contentHtml ?? "",
        sourceType: SOURCE_TYPE,
        locality: LOCALITY,
        customDateParser: (d) => d,
      });
      await saveSourceDocument({ ...doc, crawledAt: new Date() }, db);
      saved++;
    } catch (error) {
      failed++;
      logger.debug("Post processing failed", {
        sourceType: SOURCE_TYPE,
        url: item.url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("Crawl complete", {
    sourceType: SOURCE_TYPE,
    total: uniqueItems.length,
    saved,
    skipped,
    failed,
  });
}

async function filterUnprocessed(
  items: RssFeedItem[],
  db: OboDb,
): Promise<RssFeedItem[]> {
  const newItems: RssFeedItem[] = [];
  for (const item of items) {
    let wasProcessed = false;
    try {
      wasProcessed = await isUrlProcessed(item.url, db);
    } catch (error) {
      logger.error(
        "Failed to check existing URL state; skipping post to avoid duplicate writes",
        {
          sourceType: SOURCE_TYPE,
          url: item.url,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      wasProcessed = true;
    }
    if (!wasProcessed) newItems.push(item);
  }
  return newItems;
}

if (require.main === module) {
  crawl().catch((error) => {
    logger.error("Fatal error", {
      sourceType: SOURCE_TYPE,
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  });
}
