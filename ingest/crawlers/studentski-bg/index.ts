#!/usr/bin/env node

import dotenv from "dotenv";
import { resolve } from "node:path";
import { Browser } from "playwright";
import type { Firestore } from "firebase-admin/firestore";
import { SourceDocument, PostLink } from "./types";
import { launchBrowser } from "../shared/browser";
import { isUrlProcessed, saveSourceDocument } from "../shared/firestore";
import { delay } from "@/lib/delay";
import { extractPostLinks, extractPostDetails } from "./extractors";
import { buildWebPageSourceDocument } from "../shared/webpage-crawlers";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const INDEX_URL =
  "https://studentski.bg/category/%d0%b3%d1%80%d0%b0%d1%84%d0%b8%d1%86%d0%b8/";
const SOURCE_TYPE = "studentski-bg";
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds

/**
 * Main crawler function for studentski.bg
 */
export async function crawl(): Promise<void> {
  console.log("🚀 Starting studentski-bg crawler...\n");
  console.log(`📍 Index URL: ${INDEX_URL}`);
  console.log(`🗄️  Source type: ${SOURCE_TYPE}\n`);

  const { adminDb } = await import("@/lib/firebase-admin");
  let browser: Browser | null = null;

  try {
    console.log("🌐 Launching browser...");
    browser = await launchBrowser();

    const page = await browser.newPage();
    console.log(`📥 Fetching index page: ${INDEX_URL}`);
    await page.goto(INDEX_URL, { waitUntil: "networkidle" });

    const postLinks = await extractPostLinks(page);
    await page.close();

    if (postLinks.length === 0) {
      console.warn("⚠️ No posts found on index page");
      return;
    }

    console.log(`\n📊 Total posts to process: ${postLinks.length}\n`);

    let processedCount = 0;
    let skippedCount = 0;

    for (const postLink of postLinks) {
      try {
        const wasProcessed = await isUrlProcessed(postLink.url, adminDb);
        if (wasProcessed) {
          skippedCount++;
          console.log(
            `⏭️  Skipped (already processed): ${postLink.title.substring(
              0,
              60
            )}...`
          );
        } else {
          await processPost(browser, postLink, adminDb);
          processedCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing post: ${postLink.url}`, error);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Crawling completed successfully!");
    console.log(`📊 Total posts found: ${postLinks.length}`);
    console.log(`✅ Newly processed: ${processedCount}`);
    console.log(`⏭️  Skipped (already exists): ${skippedCount}`);
    console.log("=".repeat(60) + "\n");
  } catch (error) {
    console.error("\n" + "=".repeat(60));
    console.error("❌ Crawling failed with error:");
    console.error(error);
    console.error("=".repeat(60) + "\n");
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log("🔒 Browser closed");
    }
  }
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

  try {
    const alreadyProcessed = await isUrlProcessed(url, adminDb);
    if (alreadyProcessed) {
      console.log(`⏭️  Skipped (already processed): ${url}`);
      return;
    }
  } catch (error) {
    console.error(`❌ Error checking if URL is processed: ${url}`, error);
    throw error;
  }

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
