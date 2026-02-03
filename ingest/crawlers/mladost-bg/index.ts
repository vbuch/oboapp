#!/usr/bin/env node

import dotenv from "dotenv";
import { resolve } from "node:path";
import { Browser } from "playwright";
import type { Firestore } from "firebase-admin/firestore";
import { PostLink } from "./types";
import { extractPostLinks, extractPostDetails } from "./extractors";
import {
  crawlWordpressPage,
  processWordpressPost,
} from "../shared/webpage-crawlers";
import { parseBulgarianMonthDate } from "../shared/date-utils";

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const INDEX_URL = "https://mladost.bg/gradska-i-okolna-sreda/planovi-remonti";
const SOURCE_TYPE = "mladost-bg";
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds

/**
 * Process a single post with custom Bulgarian month date parser
 */
const processPost = (
  browser: Browser,
  postLink: PostLink,
  adminDb: Firestore,
) =>
  processWordpressPost(
    browser,
    postLink,
    adminDb,
    SOURCE_TYPE,
    DELAY_BETWEEN_REQUESTS,
    extractPostDetails,
    parseBulgarianMonthDate, // Custom date parser for "DD Month YYYY" format
  );

/**
 * Main crawler function
 */
export async function crawl(): Promise<void> {
  await crawlWordpressPage({
    indexUrl: INDEX_URL,
    sourceType: SOURCE_TYPE,
    extractPostLinks,
    processPost,
    delayBetweenRequests: DELAY_BETWEEN_REQUESTS,
  });
}

// Run the crawler if executed directly
if (require.main === module) {
  crawl().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
