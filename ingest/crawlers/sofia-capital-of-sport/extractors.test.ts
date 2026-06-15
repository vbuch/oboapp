import { describe, expect, it } from "vitest";
import { extractFeedItems, mergePostDetails } from "./extractors";

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Test Event</title>
      <link>https://sofia2018.bg/2026/06/test-event/</link>
      <pubDate>Mon, 15 Jun 2026 06:31:18 +0000</pubDate>
    </item>
  </channel>
</rss>`;

describe("sofia-capital-of-sport/extractors", () => {
  describe("extractFeedItems", () => {
    it("extracts items from RSS XML", () => {
      const items = extractFeedItems(SAMPLE_RSS);
      expect(items).toHaveLength(1);
      expect(items[0].url).toBe("https://sofia2018.bg/2026/06/test-event/");
      expect(items[0].title).toBe("Test Event");
      expect(items[0].date).toBe("2026-06-15T06:31:18.000Z");
    });

    it("filters items from other hostnames", () => {
      const xml = SAMPLE_RSS.replace(
        "https://sofia2018.bg/2026/06/test-event/",
        "https://example.com/test-event/",
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
    it("overrides dateText with RSS ISO date, replacing Bulgarian month-based date", () => {
      const result = mergePostDetails(
        { title: "DOM title", dateText: "юни 15", contentHtml: "<p>body</p>" },
        { title: "RSS title", date: "2026-06-15T06:31:18.000Z" },
      );
      expect(result.dateText).toBe("2026-06-15T06:31:18.000Z");
    });

    it("falls back to RSS title when DOM title is empty", () => {
      const result = mergePostDetails(
        { title: "", dateText: "", contentHtml: "" },
        { title: "RSS title", date: "2026-06-15T06:31:18.000Z" },
      );
      expect(result.title).toBe("RSS title");
    });
  });
});
