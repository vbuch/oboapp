import type { Page } from "playwright";
import {
  parseRssFeedItems,
  stripWordPressFeedAttribution,
} from "../shared/rss";
import type { RssFeedItem } from "../shared/rss";
import { SELECTORS } from "./selectors";
import { extractPostDetailsGeneric } from "../shared/extractors";

const SOURCE_HOSTNAME = "sredec-sofia.org";

export function extractFeedItems(xml: string): RssFeedItem[] {
  return parseRssFeedItems(xml, {
    hostname: SOURCE_HOSTNAME,
    contentTransform: stripWordPressFeedAttribution,
  });
}

export async function extractPostDetails(
  page: Page,
): Promise<{ title: string; dateText: string; contentHtml: string }> {
  return extractPostDetailsGeneric(page, SELECTORS.POST, ["script", "style"]);
}
