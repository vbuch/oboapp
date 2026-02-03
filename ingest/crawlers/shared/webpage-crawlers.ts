import { parseBulgarianDate } from "./date-utils";
import { createTurndownService } from "./markdown";
import { Browser, Page } from "playwright";
import type { Firestore } from "firebase-admin/firestore";
import { PostLink } from "./types";
import { launchBrowser } from "./browser";
import { isUrlProcessed, saveSourceDocument } from "./firestore";
import { delay } from "@/lib/delay";

const turndownService = createTurndownService();

/**
 * Build a SourceDocument from webpage content (HTML to Markdown conversion)
 * Used by WordPress-style crawlers like rayon-oborishte-bg and sofia-bg
 */
export function buildWebPageSourceDocument(
  url: string,
  title: string,
  dateText: string,
  contentHtml: string,
  sourceType: string,
  customDateParser?: (dateText: string) => string,
): {
  url: string;
  title: string;
  datePublished: string;
  message: string;
  sourceType: string;
} {
  if (!title) {
    throw new Error(`Failed to extract title from ${url}`);
  }

  if (!contentHtml) {
    throw new Error(`Failed to extract content from ${url}`);
  }

  // Convert HTML to Markdown
  const message = turndownService.turndown(contentHtml);

  // Parse date to ISO format (use custom parser if provided)
  const datePublished = customDateParser
    ? customDateParser(dateText)
    : parseBulgarianDate(dateText);

  return {
    url,
    title,
    datePublished,
    message,
    sourceType,
  };
}

/**
 * Process a single WordPress post
 * Generic implementation using buildWebPageSourceDocument
 */
export async function processWordpressPost<
  TPostLink extends PostLink,
  TDetails extends { title: string; dateText: string; contentHtml: string },
>(
  browser: Browser,
  postLink: TPostLink,
  adminDb: Firestore,
  sourceType: string,
  delayMs: number,
  extractPostDetails: (page: Page) => Promise<TDetails>,
  customDateParser?: (dateText: string) => string,
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
      sourceType,
      customDateParser,
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

  await delay(delayMs);
}

/**
 * Crawl a WordPress-style news page
 * Generic crawler that extracts post links from an index page and processes each post
 */
export async function crawlWordpressPage(options: {
  indexUrl: string;
  sourceType: string;
  extractPostLinks: (page: Page) => Promise<PostLink[]>;
  processPost: (
    browser: Browser,
    postLink: PostLink,
    adminDb: Firestore,
  ) => Promise<void>;
  delayBetweenRequests?: number;
}): Promise<void> {
  const {
    indexUrl,
    sourceType,
    extractPostLinks,
    processPost,
    delayBetweenRequests: _delayBetweenRequests = 2000,
  } = options;

  console.log(`🚀 Starting ${sourceType} crawler...\n`);
  console.log(`📍 Index URL: ${indexUrl}`);
  console.log(`🗄️  Source type: ${sourceType}\n`);

  const { adminDb } = await import("@/lib/firebase-admin");

  let browser: Browser | null = null;

  try {
    console.log("🌐 Launching browser...");
    browser = await launchBrowser();

    const page = await browser.newPage();
    console.log(`📥 Fetching index page: ${indexUrl}`);
    await page.goto(indexUrl, { waitUntil: "networkidle" });

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
              60,
            )}...`,
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
