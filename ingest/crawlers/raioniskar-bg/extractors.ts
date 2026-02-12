import type { Page } from "playwright";
import type { PostLink } from "./types";
import { SELECTORS } from "./selectors";
import {
  extractPostLinks as extractPostLinksShared,
  extractPostDetailsGeneric,
} from "../shared/extractors";

/**
 * Extract post links from the index page (важни съобщения section)
 */
export async function extractPostLinks(page: Page): Promise<PostLink[]> {
  // Filter to include only important messages
  // URLs use pattern: /?c=important_messages/show/{ID}&lang=bg
  const urlFilter = (url: string) => {
    return url.includes("important_messages/show/");
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
    ".bottomNav",
    "footer",
  ]);
}
