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
  // Filter to only include repair/maintenance announcement URLs
  const urlFilter = (url: string) => url.includes("/planovi-remonti/");

  return extractPostLinksShared(page, SELECTORS, urlFilter);
}

/**
 * Extract post details from individual post page
 */
export async function extractPostDetails(
  page: Page,
): Promise<{ title: string; dateText: string; contentHtml: string }> {
  return extractPostDetailsGeneric(page, SELECTORS.POST, ["script", "style"]);
}
