#!/usr/bin/env node

import dotenv from "dotenv";
import { resolve } from "node:path";
import { Browser } from "playwright";
import type { Firestore } from "firebase-admin/firestore";
import { PostLink } from "./types";
import { extractPostLinks, extractPostDetails } from "./extractors";
import {
  crawlWordpressPage,
  buildWebPageSourceDocument,
} from "../shared/webpage-crawlers";
import { parseBulgarianMonthDate } from "../shared/date-utils";
import { delay } from "@/lib/delay";
import { saveSourceDocument } from "../shared/firestore";

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const INDEX_URL = "https://mladost.bg/gradska-i-okolna-sreda/planovi-remonti";
const SOURCE_TYPE = "mladost-bg";
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds

/**
 * Process a single post with custom Bulgarian month date parser
 */
const processPost = async (
  browser: Browser,
  postLink: PostLink,
  adminDb: Firestore,
): Promise<void> => {
  const { url, title } = postLink;

  console.log(`\n🔍 Processing: ${title.substring(0, 60)}...`);

  const page = await browser.newPage();

  try {
    console.log(`📥 Fetching: ${url}`);
    await page.goto(url, { waitUntil: "networkidle" });

    const details = await extractPostDetails(page);

    // Use custom Bulgarian month date parser
    const postDetails = buildWebPageSourceDocument(
      url,
      details.title,
      details.dateText,
      details.contentHtml,
      SOURCE_TYPE,
      parseBulgarianMonthDate, // Custom date parser for "DD Month YYYY" format
    );

    const sourceDoc = {
      ...postDetails,
      crawledAt: new Date(),
    };

    await saveSourceDocument(sourceDoc, adminDb);

    console.log(`✅ Successfully processed: ${title.substring(0, 60)}...`);
  } catch (error) {
    console.error(`❌ Error processing post: ${url}`, error);
    throw error;
  } finally {
    await page.close();
  }

  await delay(DELAY_BETWEEN_REQUESTS);
};

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
