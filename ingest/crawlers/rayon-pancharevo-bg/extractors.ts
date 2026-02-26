import type { Page } from "playwright";
import type { PostLink } from "./types";
import { SELECTORS } from "./selectors";
import {
  extractPostLinks as extractPostLinksShared,
  extractPostDetailsGeneric,
} from "../shared/extractors";

/**
 * Extract post links from the index page.
 */
export async function extractPostLinks(page: Page): Promise<PostLink[]> {
  const urlFilter = (url: string) => {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return false;
    }

    let decodedPath = parsedUrl.pathname.toLowerCase();
    try {
      decodedPath = decodeURIComponent(decodedPath).toLowerCase();
    } catch {
      // Keep raw path if decoding fails
    }

    if (!decodedPath.includes("/ремонти-и-инфраструктура/")) {
      return false;
    }

    // Exclude listing/pagination URLs
    if (parsedUrl.searchParams.has("start")) {
      return false;
    }

    return (
      decodedPath.includes("ремонт") ||
      decodedPath.includes("инфраструкт") ||
      decodedPath.includes("водоподав") ||
      decodedPath.includes("авар") ||
      decodedPath.includes("подмян") ||
      /\/ремонти-и-инфраструктура\/\d+[-/]/.test(decodedPath)
    );
  };

  return extractPostLinksShared(page, SELECTORS, urlFilter);
}

/**
 * Extract post details from individual post page.
 */
export async function extractPostDetails(
  page: Page,
): Promise<{ title: string; dateText: string; contentHtml: string }> {
  const details = await extractPostDetailsGeneric(page, SELECTORS.POST, [
    "script",
    "style",
    "nav",
    "footer",
    ".sharedaddy",
    ".share-buttons",
    ".post-navigation",
  ]);

  // Pancharevo posts often don't have a dedicated date element.
  // Fallback order: extracted date -> title -> first content paragraph text.
  if (details.dateText.trim().length > 0) {
    return details;
  }

  const firstParagraphText = await page.evaluate(() => {
    const p = document.querySelector("article.item-page [itemprop='articleBody'] p, [itemprop='articleBody'] p, article.item-page p");
    return p?.textContent?.trim() || "";
  });

  const fallbackDateText = details.title || firstParagraphText;

  return {
    ...details,
    dateText: fallbackDateText,
  };
}
