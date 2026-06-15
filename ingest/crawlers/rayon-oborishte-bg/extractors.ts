import type { Page } from "playwright";
import {
  parseRssFeedItems,
  stripWordPressFeedAttribution,
} from "../shared/rss";
import type { RssFeedItem } from "../shared/rss";
import { SELECTORS } from "./selectors";
import { extractPostDetailsGeneric } from "../shared/extractors";

const SOURCE_HOSTNAME = "rayon-oborishte.bg";

/**
 * Parse RSS feed items from rayon-oborishte.bg.
 */
export function extractFeedItems(xml: string): RssFeedItem[] {
  return parseRssFeedItems(xml, {
    hostname: SOURCE_HOSTNAME,
    dateTag: "pubDate",
    contentTag: "description",
    contentTransform: stripWordPressFeedAttribution,
  });
}

/**
 * Extract post details from an individual article page.
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
