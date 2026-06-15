import { describe, expect, it, vi } from "vitest";
import { extractFeedItems, extractPostDetails } from "./extractors";
import { SELECTORS } from "./selectors";

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

  describe("extractPostDetails", () => {
    it("extracts structured post details from the page", async () => {
      const evaluate = vi.fn().mockResolvedValue({
        title: "Page title",
        dateText: "30.12.2025",
        contentHtml: "<p>Body content</p>",
      });

      const page = {
        evaluate,
      } as unknown as Parameters<typeof extractPostDetails>[0];

      const result = await extractPostDetails(page);

      expect(result).toEqual({
        title: "Page title",
        dateText: "30.12.2025",
        contentHtml: "<p>Body content</p>",
      });
      expect(evaluate).toHaveBeenCalledTimes(1);
      expect(evaluate).toHaveBeenCalledWith(expect.any(Function), SELECTORS);
    });
  });
});
