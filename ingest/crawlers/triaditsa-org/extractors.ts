import {
  parseRssFeedItems,
  stripWordPressFeedAttribution,
} from "../shared/rss";
import type { RssFeedItem } from "../shared/rss";

const SOURCE_HOSTNAME = "triaditza.org";

export function extractFeedItems(xml: string): RssFeedItem[] {
  return parseRssFeedItems(xml, {
    hostname: SOURCE_HOSTNAME,
    contentTag: "content:encoded",
    contentTransform: stripWordPressFeedAttribution,
  });
}
