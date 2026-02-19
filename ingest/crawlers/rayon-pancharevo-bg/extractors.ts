import type { Page } from "playwright";
import type { PostLink } from "./types";
import { SELECTORS } from "./selectors";
import {
  extractPostLinks as extractPostLinksShared,
  extractPostDetailsGeneric,
} from "../shared/extractors";

/**
 * Extract post links from the index page
 */
export async function extractPostLinks(page: Page): Promise<PostLink[]> {
  // Filter to include repair and infrastructure notifications.
  // Accept URLs containing: 'ремонт' (repair), 'инфраструктура' (infrastructure),
  // or numeric IDs. The AI categorization stage will handle final relevance filtering.
  const urlFilter = (url: string) => {
    let decodedUrl: string;
    try {
      decodedUrl = decodeURIComponent(url).toLowerCase();
    } catch {
      decodedUrl = url.toLowerCase();
    }
    return (
      decodedUrl.includes("ремонт") ||
      decodedUrl.includes("инфраструктура") ||
      /\/\d+(-\d+)?\/?$/.test(decodedUrl) // Numeric IDs like /21862-2/
    );
  };

  return extractPostLinksShared(page, SELECTORS, urlFilter);
}

/**
 * Extract post details from individual post page
 */
export async function extractPostDetails(
  page: Page,
): Promise<{ title: string; dateText: string; contentHtml: string }> {
  return extractPostDetailsGeneric(page, SELECTORS.POST, [
    "script",
    "style",
    "nav",
    ".sharedaddy",
    ".share-buttons",
    ".navigation",
    ".post-navigation",
    ".item-navigation",
  ]);
}
