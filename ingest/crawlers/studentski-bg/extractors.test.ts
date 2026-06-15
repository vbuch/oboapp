import { describe, expect, it } from "vitest";
import { extractFeedItems, mergePostDetails } from "./extractors";

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Test Post</title>
      <link>https://studentski.bg/test-post/</link>
      <pubDate>Fri, 12 Jun 2026 08:48:16 +0000</pubDate>
    </item>
  </channel>
</rss>`;

describe("studentski-bg/extractors", () => {
  describe("extractFeedItems", () => {
    it("extracts items from RSS XML", () => {
      const items = extractFeedItems(SAMPLE_RSS);
      expect(items).toHaveLength(1);
      expect(items[0].url).toBe("https://studentski.bg/test-post/");
      expect(items[0].title).toBe("Test Post");
      expect(items[0].date).toBe("2026-06-12T08:48:16.000Z");
    });

    it("filters items from other hostnames", () => {
      const xml = SAMPLE_RSS.replace(
        "https://studentski.bg/test-post/",
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
          dateText: "12.06.2026",
          contentHtml: "<p>body</p>",
        },
        { title: "RSS title", date: "2026-06-12T08:48:16.000Z" },
      );
      expect(result.dateText).toBe("2026-06-12T08:48:16.000Z");
    });

    it("falls back to RSS title when DOM title is empty", () => {
      const result = mergePostDetails(
        { title: "", dateText: "", contentHtml: "" },
        { title: "RSS title", date: "2026-06-12T08:48:16.000Z" },
      );
      expect(result.title).toBe("RSS title");
    });
  });
});
