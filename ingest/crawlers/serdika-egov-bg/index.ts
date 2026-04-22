#!/usr/bin/env node

import dotenv from "dotenv";
import { resolve } from "node:path";
import type { OboDb } from "@oboapp/db";
import type { PostLink } from "./types";
import {
  fetchPostLinksFromFeed,
  fetchPostDetailsFromHttp,
  parseSerdikaDate,
} from "./extractors";
import { buildWebPageSourceDocument } from "../shared/webpage-crawlers";
import { isUrlProcessed, saveSourceDocument } from "../shared/firestore";
import { delay } from "@/lib/delay";
import { logger } from "@/lib/logger";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

/**
 * Each section maps to:
 *  - a WCM keyword used in the search feed (derived from the portal URL path)
 *  - the section label used in log messages
 */
const SECTIONS = [
  { keyword: "actualmessages", label: "messages" },
  { keyword: "actualnews", label: "news" },
  { keyword: "actualevents", label: "events" },
] as const;

const SOURCE_TYPE = "serdika-egov-bg";
const LOCALITY = "bg.sofia";
const DELAY_BETWEEN_REQUESTS = 2000;

async function processPost(postLink: PostLink, db: OboDb): Promise<void> {
  logger.debug("Fetching post", {
    sourceType: SOURCE_TYPE,
    url: postLink.url,
    title: postLink.title.substring(0, 60),
  });

  const details = await fetchPostDetailsFromHttp(postLink.url);
  const postDetails = buildWebPageSourceDocument({
    url: postLink.url,
    title: details.title,
    dateText: details.dateText,
    contentHtml: details.contentHtml,
    sourceType: SOURCE_TYPE,
    locality: LOCALITY,
    customDateParser: parseSerdikaDate,
  });

  await saveSourceDocument(
    {
      ...postDetails,
      crawledAt: new Date(),
    },
    db,
    { logSuccess: false },
  );

  logger.debug("Saved post", {
    sourceType: SOURCE_TYPE,
    title: postLink.title.substring(0, 60),
    url: postLink.url,
  });
}

export async function crawl(): Promise<void> {
  const { getDb } = await import("@/lib/db");
  const db = await getDb();

  for (const { keyword, label } of SECTIONS) {
    logger.info("Fetching post list from search feed", {
      sourceType: SOURCE_TYPE,
      section: label,
    });

    let postLinks: PostLink[];
    try {
      postLinks = await fetchPostLinksFromFeed(keyword);
    } catch (err) {
      logger.warn("Failed to fetch post list", {
        sourceType: SOURCE_TYPE,
        section: label,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    if (postLinks.length === 0) {
      logger.warn("No posts found in feed", {
        sourceType: SOURCE_TYPE,
        section: label,
      });
      continue;
    }

    let saved = 0,
      skipped = 0,
      failed = 0;

    for (const postLink of postLinks) {
      const wasProcessed = await isUrlProcessed(postLink.url, db);
      if (wasProcessed) {
        skipped++;
        continue;
      }
      try {
        await processPost(postLink, db);
        saved++;
      } catch (err) {
        failed++;
        logger.warn("Failed to fetch post", {
          sourceType: SOURCE_TYPE,
          url: postLink.url,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        await delay(DELAY_BETWEEN_REQUESTS);
      }
    }

    logger.info("Section complete", {
      sourceType: SOURCE_TYPE,
      section: label,
      total: postLinks.length,
      saved,
      skipped,
      failed,
    });
  }
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
