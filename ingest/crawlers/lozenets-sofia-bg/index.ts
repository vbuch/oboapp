#!/usr/bin/env node

import dotenv from "dotenv";
import { resolve } from "node:path";
import type { Browser } from "playwright";
import type { OboDb } from "@oboapp/db";
import type { RssFeedItem } from "../shared/rss";
import { mergePostDetails } from "../shared/rss";
import { crawlHybridRss } from "../shared/rss-crawler";
import { extractFeedItems, extractPostDetails } from "./extractors";
import { processWordpressPost } from "../shared/webpage-crawlers";
import { logger } from "@/lib/logger";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const FEED_URL =
  "https://lozenets.sofia.bg/category/%d0%bd%d0%be%d0%b2%d0%b8%d0%bd%d0%b8/feed/";
const SOURCE_TYPE = "lozenets-sofia-bg";
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
  return crawlHybridRss({
    feedUrl: FEED_URL,
    sourceType: SOURCE_TYPE,
    extractItems: extractFeedItems,
    processPost,
  });
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
