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
  // No URL filter needed - accept all links from the index page
  return extractPostLinksShared(page, SELECTORS);
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
    ".wpex-social-share",
    ".related-posts",
    ".navigation",
  ]);
}
