#!/usr/bin/env node

import dotenv from "dotenv";
import { resolve } from "node:path";
import type { Browser } from "playwright";
import type { OboDb } from "@oboapp/db";
import type { RssFeedItem } from "../shared/rss";
import { fetchFeedXml } from "../shared/rss";
import {
  extractFeedItems,
  extractPostDetails,
  mergePostDetails,
} from "./extractors";
import { launchBrowser } from "../shared/browser";
import { isUrlProcessed } from "../shared/firestore";
import { processWordpressPost } from "../shared/webpage-crawlers";
import { logger } from "@/lib/logger";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const FEED_URL =
  "https://studentski.bg/category/%d0%b3%d1%80%d0%b0%d1%84%d0%b8%d1%86%d0%b8/feed/";
const SOURCE_TYPE = "studentski-bg";
const LOCALITY = "bg.sofia";
const DELAY_BETWEEN_REQUESTS = 2000;

const processPost = (browser: Browser, item: RssFeedItem, db: OboDb) =>
  processWordpressPost(
    browser,
    item,
    db,
    SOURCE_TYPE,
    LOCALITY,
    DELAY_BETWEEN_REQUESTS,
    async (page) => mergePostDetails(await extractPostDetails(page), item),
    (d) => d,
  );

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

  const { saved, failed } = await processNewItems(newItems, db);

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

async function processNewItems(
  items: RssFeedItem[],
  db: OboDb,
): Promise<{ saved: number; failed: number }> {
  const browser = await launchBrowser();
  let saved = 0;
  let failed = 0;

  try {
    for (const item of items) {
      try {
        await processPost(browser, item, db);
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
  } finally {
    await browser.close();
  }

  return { saved, failed };
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
