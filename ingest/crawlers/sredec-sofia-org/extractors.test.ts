import { describe, expect, it } from "vitest";
import { extractFeedItems, mergePostDetails } from "./extractors";

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Test Post</title>
      <link>https://sredec-sofia.org/test-post/</link>
      <pubDate>Mon, 14 Jul 2025 18:44:21 +0000</pubDate>
    </item>
  </channel>
</rss>`;

describe("sredec-sofia-org/extractors", () => {
  describe("extractFeedItems", () => {
    it("extracts items from RSS XML", () => {
      const items = extractFeedItems(SAMPLE_RSS);
      expect(items).toHaveLength(1);
      expect(items[0].url).toBe("https://sredec-sofia.org/test-post/");
      expect(items[0].title).toBe("Test Post");
      expect(items[0].date).toBe("2025-07-14T18:44:21.000Z");
    });

    it("filters items from other hostnames", () => {
      const xml = SAMPLE_RSS.replace(
        "https://sredec-sofia.org/test-post/",
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

  describe("mergePostDetails", () => {
    it("overrides dateText with RSS date", () => {
      const result = mergePostDetails(
        {
          title: "DOM title",
          dateText: "14.07.2025",
          contentHtml: "<p>body</p>",
        },
        { title: "RSS title", date: "2025-07-14T18:44:21.000Z" },
      );
      expect(result.dateText).toBe("2025-07-14T18:44:21.000Z");
    });

    it("falls back to RSS title when DOM title is empty", () => {
      const result = mergePostDetails(
        { title: "", dateText: "", contentHtml: "" },
        { title: "RSS title", date: "2025-07-14T18:44:21.000Z" },
      );
      expect(result.title).toBe("RSS title");
    });
  });
});
