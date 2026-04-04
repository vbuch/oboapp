#!/usr/bin/env node

import dotenv from "dotenv";
import { resolve } from "node:path";
import { Browser } from "playwright";
import type { OboDb } from "@oboapp/db";
import { PostLink } from "./types";
import { extractPostLinks, extractPostDetails } from "./extractors";
import {
  crawlWordpressPage,
  processWordpressPost,
} from "../shared/webpage-crawlers";
import { logger } from "@/lib/logger";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const INDEX_URL =
  "https://sofia2018.bg/%D1%81%D1%8A%D0%B1%D0%B8%D1%82%D0%B8%D1%8F/";
const SOURCE_TYPE = "sofia-capital-of-sport";
const LOCALITY = "bg.sofia";
const DELAY_BETWEEN_REQUESTS = 2000;

const BULGARIAN_MONTH_TO_INDEX: Record<string, number> = {
  януари: 0,
  февруари: 1,
  март: 2,
  април: 3,
  май: 4,
  юни: 5,
  юли: 6,
  август: 7,
  септември: 8,
  октомври: 9,
  ноември: 10,
  декември: 11,
};

function parseEventDate(dateText: string): string {
  const normalized = dateText.toLowerCase().trim().replace(/\s+/g, " ");
  const match = normalized.match(
    /(януари|февруари|март|април|май|юни|юли|август|септември|октомври|ноември|декември)\s+(\d{1,2})/,
  );

  if (!match) {
    logger.warn(
      "Unable to parse Sofia Capital of Sport date, using current date",
      {
        sourceType: SOURCE_TYPE,
        dateText,
      },
    );
    return new Date().toISOString();
  }

  const [, monthName, dayStr] = match;
  const monthIndex = BULGARIAN_MONTH_TO_INDEX[monthName];
  const day = Number.parseInt(dayStr, 10);

  if (monthIndex === undefined || Number.isNaN(day)) {
    logger.warn(
      "Invalid Sofia Capital of Sport date components, using current date",
      {
        sourceType: SOURCE_TYPE,
        dateText,
      },
    );
    return new Date().toISOString();
  }

  const year = new Date().getFullYear();
  const parsed = new Date(Date.UTC(year, monthIndex, day));

  if (Number.isNaN(parsed.getTime())) {
    logger.warn("Invalid Sofia Capital of Sport date, using current date", {
      sourceType: SOURCE_TYPE,
      dateText,
    });
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

const processPost = (browser: Browser, postLink: PostLink, db: OboDb) =>
  processWordpressPost(
    browser,
    postLink,
    db,
    SOURCE_TYPE,
    LOCALITY,
    DELAY_BETWEEN_REQUESTS,
    extractPostDetails,
    parseEventDate,
  );

export async function crawl(): Promise<void> {
  await crawlWordpressPage({
    indexUrl: INDEX_URL,
    sourceType: SOURCE_TYPE,
    extractPostLinks,
    processPost,
    delayBetweenRequests: DELAY_BETWEEN_REQUESTS,
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
