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
  "https://sredec-sofia.org/category/%d0%bf%d1%83%d0%b1%d0%bb%d0%b8%d0%ba%d0%b0%d1%86%d0%b8%d0%b8/%d0%bf%d0%be%d0%bb%d0%b5%d0%b7%d0%bd%d0%b0-%d0%b8%d0%bd%d1%84%d0%be%d1%80%d0%bc%d0%b0%d1%86%d0%b8%d1%8f/feed/";
const SOURCE_TYPE = "sredec-sofia-org";
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
