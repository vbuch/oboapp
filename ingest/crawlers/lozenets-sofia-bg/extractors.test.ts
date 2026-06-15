import { describe, expect, it } from "vitest";
import { extractFeedItems } from "./extractors";

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Test Post</title>
      <link>https://lozenets.sofia.bg/test-post/</link>
      <pubDate>Mon, 15 Jun 2026 11:41:03 +0000</pubDate>
    </item>
  </channel>
</rss>`;

describe("lozenets-sofia-bg/extractors", () => {
  describe("extractFeedItems", () => {
    it("extracts items from RSS XML", () => {
      const items = extractFeedItems(SAMPLE_RSS);
      expect(items).toHaveLength(1);
      expect(items[0].url).toBe("https://lozenets.sofia.bg/test-post/");
      expect(items[0].title).toBe("Test Post");
      expect(items[0].date).toBe("2026-06-15T11:41:03.000Z");
    });

    it("filters items from other hostnames", () => {
      const xml = SAMPLE_RSS.replace(
        "https://lozenets.sofia.bg/test-post/",
        "https://example.com/test-post/",
      );
      expect(extractFeedItems(xml)).toHaveLength(0);
    });

    it("returns empty array for empty feed", () => {
      expect(
        extractFeedItems(`<?xml version="1.0"?><rss><channel></channel></rss>`),
      ).toHaveLength(0);
    });
  });
});
