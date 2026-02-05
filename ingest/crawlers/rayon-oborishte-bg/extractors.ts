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
  // Filter to include repair notifications while excluding navigation pages.
  // Accept URLs containing: 'уведомление' (notification), 'ремонт' (repair),
  // 'затваряни' (closing), or numeric IDs (e.g., /21862-2/).
  // The AI categorization stage will handle final relevance filtering.
  const urlFilter = (url: string) => {
    let decodedUrl: string;
    try {
      decodedUrl = decodeURIComponent(url).toLowerCase();
    } catch {
      decodedUrl = url.toLowerCase();
    }
    return (
      decodedUrl.includes("уведомление") ||
      decodedUrl.includes("ремонт") ||
      decodedUrl.includes("затваряни") ||
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
  ]);
}
