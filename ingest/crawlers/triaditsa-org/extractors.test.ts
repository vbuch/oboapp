import { describe, expect, it } from "vitest";
import { extractFeedItems } from "./extractors";

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <item>
      <title>Test Post</title>
      <link>https://triaditza.org/test-post/</link>
      <pubDate>Tue, 09 Jun 2026 11:13:10 +0000</pubDate>
      <content:encoded><![CDATA[<p>Test content</p>]]></content:encoded>
    </item>
  </channel>
</rss>`;

describe("triaditsa-org/extractors", () => {
  describe("extractFeedItems", () => {
    it("extracts items from RSS XML including content:encoded", () => {
      const items = extractFeedItems(SAMPLE_RSS);
      expect(items).toHaveLength(1);
      expect(items[0].url).toBe("https://triaditza.org/test-post/");
      expect(items[0].title).toBe("Test Post");
      expect(items[0].date).toBe("2026-06-09T11:13:10.000Z");
      expect(items[0].contentHtml).toBe("<p>Test content</p>");
    });

    it("filters items from other hostnames", () => {
      const xml = SAMPLE_RSS.replace(
        "https://triaditza.org/test-post/",
        "https://example.com/test-post/",
      );
      expect(extractFeedItems(xml)).toHaveLength(0);
    });

    it("strips WordPress attribution from content", () => {
      const xml = SAMPLE_RSS.replace(
        "<p>Test content</p>",
        '<p>Test content</p><p>Материалът <a href="https://triaditza.org/test-post/">Test Post</a> е публикуван за пръв път на <a href="https://triaditza.org">Район Триадица</a>.</p>',
      );
      const items = extractFeedItems(xml);
      expect(items[0].contentHtml).not.toContain("публикуван за пръв път");
    });
  });
});
