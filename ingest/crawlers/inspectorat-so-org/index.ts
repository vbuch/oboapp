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

const INDEX_URL = "https://inspectorat-so.org/%D0%BD%D0%BE%D0%B2%D0%B8%D0%BD%D0%B8";
const SOURCE_TYPE = "inspectorat-so-org";
const LOCALITY = "bg.sofia";
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds
const MAX_FUTURE_DAYS_FOR_SHORT_DATE = 7;

const BG_MONTH_TO_NUMBER: Record<string, string> = {
  "ян": "01",
  "фев": "02",
  "март": "03",
  "апр": "04",
  "май": "05",
  "юни": "06",
  "юли": "07",
  "авг": "08",
  "сеп": "09",
  "окт": "10",
  "ное": "11",
  "дек": "12",
};

function inferShortDateYear(
  day: string,
  month: string,
  referenceDate: Date,
): number {
  const currentYear = referenceDate.getFullYear();
  const candidateThisYear = new Date(
    `${currentYear}-${month}-${day}T00:00:00+02:00`,
  );

  if (Number.isNaN(candidateThisYear.getTime())) {
    return currentYear;
  }

  const futureThresholdMs =
    MAX_FUTURE_DAYS_FOR_SHORT_DATE * 24 * 60 * 60 * 1000;
  const isTooFarInFuture =
    candidateThisYear.getTime() - referenceDate.getTime() > futureThresholdMs;

  return isTooFarInFuture ? currentYear - 1 : currentYear;
}

export function parseInspectoratDate(
  dateText: string,
  fallbackDateText?: string,
  referenceDate = new Date(),
): string {
  const candidate = (dateText || fallbackDateText || "").replace(/\s+/g, " ").trim();

  const directMatch = /(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/.exec(candidate);
  if (directMatch) {
    const [, dayRaw, monthRaw, yearRaw] = directMatch;
    const day = dayRaw.padStart(2, "0");
    const month = monthRaw.padStart(2, "0");
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    const parsed = new Date(`${year}-${month}-${day}T00:00:00+02:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  const shortMonthMatch = /(\d{1,2})\s*([а-я]+)/i.exec(candidate);
  if (shortMonthMatch) {
    const [, dayRaw, monthRaw] = shortMonthMatch;
    const monthKey = monthRaw.toLowerCase().replace(/\.$/, "");
    const mappedMonth = BG_MONTH_TO_NUMBER[monthKey];

    if (mappedMonth) {
      const day = dayRaw.padStart(2, "0");
      const year = inferShortDateYear(day, mappedMonth, referenceDate);
      const parsed = new Date(`${year}-${mappedMonth}-${day}T00:00:00+02:00`);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }

  logger.warn("Unable to parse inspectorat date, using current date", {
    sourceType: SOURCE_TYPE,
    dateText,
    fallbackDateText: fallbackDateText || "",
  });

  return new Date().toISOString();
}

const processPost = (
  browser: Browser,
  postLink: PostLink,
  db: OboDb,
) =>
  processWordpressPost(
    browser,
    postLink,
    db,
    SOURCE_TYPE,
    LOCALITY,
    DELAY_BETWEEN_REQUESTS,
    extractPostDetails,
    (dateText) => parseInspectoratDate(dateText, postLink.date),
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
      error: error instanceof Error ? error.message : String(error),
      sourceType: SOURCE_TYPE,
    });
    process.exit(1);
  });
}
