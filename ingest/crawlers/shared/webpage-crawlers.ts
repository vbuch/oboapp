import { parseBulgarianDate } from "./date-utils";
import { createTurndownService } from "./markdown";
import { Browser, Page } from "playwright";
import type { Firestore } from "firebase-admin/firestore";
import { PostLink } from "./types";
import { launchBrowser } from "./browser";
import { isUrlProcessed, saveSourceDocument } from "./firestore";
import { delay } from "@/lib/delay";
import { logger } from "@/lib/logger";

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

  logger.info("Processing post", { title: title.substring(0, 60) });

  const page = await browser.newPage();

  try {
    logger.info("Fetching post", { url });
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

    logger.info("Successfully processed post", { title: title.substring(0, 60) });
  } catch (error) {
    logger.error("Error processing post", { url, error: error instanceof Error ? error.message : String(error) });
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

  logger.info("Starting crawler", { sourceType, indexUrl });

  const { adminDb } = await import("@/lib/firebase-admin");

  let browser: Browser | null = null;

  try {
    logger.info("Launching browser");
    browser = await launchBrowser();

    const page = await browser.newPage();
    logger.info("Fetching index page", { url: indexUrl });
    await page.goto(indexUrl, { waitUntil: "networkidle" });

    const postLinks = await extractPostLinks(page);
    await page.close();

    if (postLinks.length === 0) {
      logger.warn("No posts found on index page");
      return;
    }

    logger.info("Total posts to process", { count: postLinks.length });

    let processedCount = 0;
    let skippedCount = 0;

    for (const postLink of postLinks) {
      try {
        const wasProcessed = await isUrlProcessed(postLink.url, adminDb);

        if (wasProcessed) {
          skippedCount++;
          logger.info("Skipped already processed post", { title: postLink.title.substring(0, 60) });
        } else {
          await processPost(browser, postLink, adminDb);
          processedCount++;
        }
      } catch (error) {
        logger.error("Error processing post", { url: postLink.url, error: error instanceof Error ? error.message : String(error) });
      }
    }

    logger.info("Crawling completed successfully", { totalPosts: postLinks.length, processedCount, skippedCount });
  } catch (error) {
    logger.error("Crawling failed", { error: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      logger.info("Browser closed");
    }
  }
}
