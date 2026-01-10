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

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const INDEX_URL =
  "https://studentski.bg/category/%d0%b3%d1%80%d0%b0%d1%84%d0%b8%d1%86%d0%b8/";
const SOURCE_TYPE = "studentski-bg";
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds

/**
 * Main crawler function for studentski.bg
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

/**
 * Process a single post
 */
async function processPost(
  browser: Browser,
  postLink: PostLink,
  adminDb: Firestore
): Promise<void> {
  const { url, title } = postLink;

  console.log(`\n🔍 Processing: ${title.substring(0, 60)}...`);

  const page = await browser.newPage();

  try {
    console.log(`📥 Fetching: ${url}`);
    await page.goto(url, { waitUntil: "networkidle" });

    const details = await extractPostDetails(page);

    const postDetails = buildWebPageSourceDocument(
      url,
      details.title,
      details.dateText,
      details.contentHtml,
      SOURCE_TYPE
    ) as Omit<SourceDocument, "crawledAt">;

    const sourceDoc: SourceDocument = {
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
}

if (require.main === module) {
  crawl().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
