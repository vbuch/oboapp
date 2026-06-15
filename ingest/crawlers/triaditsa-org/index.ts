#!/usr/bin/env node

import dotenv from "dotenv";
import { resolve } from "node:path";
import { crawlFullRss } from "../shared/rss-crawler";
import { extractFeedItems } from "./extractors";
import { logger } from "@/lib/logger";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const FEED_URL =
  "https://triaditza.org/category/%D0%BD%D0%BE%D0%B2%D0%B8%D0%BD%D0%B8-%D0%B8-%D1%81%D1%8A%D0%B1%D0%B8%D1%82%D0%B8%D1%8F/feed/";
const SOURCE_TYPE = "triaditsa-org";
const LOCALITY = "bg.sofia";

export async function crawl(): Promise<void> {
  return crawlFullRss({
    feedUrl: FEED_URL,
    sourceType: SOURCE_TYPE,
    locality: LOCALITY,
    extractItems: extractFeedItems,
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
