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

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const INDEX_URL =
  "https://mladost.bg/%d0%b2%d1%81%d0%b8%d1%87%d0%ba%d0%b8-%d0%bd%d0%be%d0%b2%d0%b8%d0%bd%d0%b8/%d0%b8%d0%bd%d1%84%d0%be%d1%80%d0%bc%d0%b0%d1%86%d0%b8%d1%8f-%d0%be%d1%82%d0%bd%d0%be%d1%81%d0%bd%d0%be-%d0%bf%d0%bb%d0%b0%d0%bd%d0%be%d0%b2%d0%b8%d1%82%d0%b5-%d1%80%d0%b5%d0%bc%d0%be%d0%bd%d1%82/";
const SOURCE_TYPE = "mladost-bg";
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds

/**
 * Process a single post
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
