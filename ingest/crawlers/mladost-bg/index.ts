#!/usr/bin/env node

import dotenv from "dotenv";
import { resolve } from "node:path";
import { Browser } from "playwright";
import type { Firestore } from "firebase-admin/firestore";
import { SourceDocument, PostLink } from "./types";
import { saveSourceDocument } from "../shared/firestore";
import { delay } from "@/lib/delay";
import { extractPostLinks, extractPostDetails } from "./extractors";
import {
  buildWebPageSourceDocument,
  crawlWordpressPage,
} from "../shared/webpage-crawlers";
import { parseShortBulgarianDateTime } from "../shared/date-utils";

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const INDEX_URL =
  "https://mladost.bg/%d0%b2%d1%81%d0%b8%d1%87%d0%ba%d0%b8-%d0%bd%d0%be%d0%b2%d0%b8%d0%bd%d0%b8/%d0%b8%d0%bd%d1%84%d0%be%d1%80%d0%bc%d0%b0%d1%86%d0%b8%d1%8f-%d0%be%d1%82%d0%bd%d0%be%d1%81%d0%bd%d0%be-%d0%bf%d0%bb%d0%b0%d0%bd%d0%be%d0%b2%d0%b8%d1%82%d0%b5-%d1%80%d0%b5%d0%bc%d0%be%d0%bd%d1%82/";
const SOURCE_TYPE = "mladost-bg";
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds

/**
 * Process a single post
 */
async function processPost(
  browser: Browser,
  postLink: PostLink,
  adminDb: Firestore
): Promise<void> {
  const { url, title, date, time } = postLink;

  console.log(`\n🔍 Processing: ${title.substring(0, 60)}...`);

  const page = await browser.newPage();

  try {
    console.log(`📥 Fetching: ${url}`);
    await page.goto(url, { waitUntil: "networkidle" });

    // Extract post details
    const details = await extractPostDetails(page);

    // Combine date and time from index page for custom parser
    const dateText = time ? `${date} ${time}` : date;

    // Use buildWebPageSourceDocument with custom date parser for DD.MM.YY format
    const postDetails = buildWebPageSourceDocument(
      url,
      details.title || title, // Prefer detail page title, fallback to index
      dateText,
      details.contentHtml,
      SOURCE_TYPE,
      (dateStr) => {
        const [datePart, timePart] = dateStr.split(" ");
        return parseShortBulgarianDateTime(datePart, timePart);
      }
    ) as Omit<SourceDocument, "crawledAt">;

    // Save to Firestore
    const sourceDoc: SourceDocument = {
      ...postDetails,
      crawledAt: new Date(),
    };

    await saveSourceDocument(sourceDoc, adminDb);

    console.log(`✅ Successfully processed: ${title.substring(0, 60)}...`);
  } catch (error) {
    console.error(`❌ Error processing post: ${url}`, error);
    throw error; // Re-throw to fail the entire process
  } finally {
    await page.close();
  }

  // Wait before next request
  await delay(DELAY_BETWEEN_REQUESTS);
}

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
  // eslint-disable-next-line unicorn/prefer-top-level-await
  crawl().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
