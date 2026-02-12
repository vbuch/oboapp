import { describe, it, expect, vi } from "vitest";
import { extractPostLinks, extractPostDetails } from "./extractors";

// Mock Page type from Playwright
interface MockPage {
  evaluate: <T>(fn: (...args: any[]) => T, ...args: any[]) => Promise<T>;
}

function createMockPage(mockEvaluate: any): MockPage {
  return {
    evaluate: mockEvaluate,
  } as MockPage;
}

describe("raioniskar-bg/extractors", () => {
  describe("extractPostLinks", () => {
    it("should extract post links from important messages section", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://raioniskar.bg/?c=important_messages/show/2833&lang=bg",
          title: "Топлофикация - уведомление за авария",
          date: "2026-02-10",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].url).toContain("important_messages/show");
      expect(posts[0].title).toBe("Топлофикация - уведомление за авария");
    });

    it("should extract multiple post links", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://raioniskar.bg/?c=important_messages/show/2833&lang=bg",
          title: "Post 1",
          date: "2026-02-10",
        },
        {
          url: "https://raioniskar.bg/?c=important_messages/show/2832&lang=bg",
          title: "Post 2",
          date: "2026-02-02",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(2);
      expect(posts[0].title).toBe("Post 1");
      expect(posts[1].title).toBe("Post 2");
    });

    it("should return empty array when no posts found", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toEqual([]);
    });

    it("should filter posts by URL pattern (must contain important_messages/show)", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://raioniskar.bg/?c=important_messages/show/2833&lang=bg",
          title: "Valid Post",
          date: "2026-02-10",
        },
        {
          url: "https://raioniskar.bg/?c=news/show/123&lang=bg",
          title: "News Post - Should be filtered out",
          date: "2026-02-09",
        },
        {
          url: "https://raioniskar.bg/?c=articles/show/456&lang=bg",
          title: "Article - Should be filtered out",
          date: "2026-02-08",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].url).toContain("important_messages/show");
      expect(posts[0].title).toBe("Valid Post");
    });

    it("should handle posts with empty dates", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://raioniskar.bg/?c=important_messages/show/2833&lang=bg",
          title: "Test Post",
          date: "",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].date).toBe("");
    });
  });

  describe("extractPostDetails", () => {
    it("should extract post details from valid page", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Топлофикация - уведомление за авария",
        dateText: "2026-02-02",
        contentHtml: "<p>Test content</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe("Топлофикация - уведомление за авария");
      expect(details.dateText).toBe("2026-02-02");
      expect(details.contentHtml).toBe("<p>Test content</p>");
    });

    it("should handle missing title", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "",
        dateText: "2026-02-02",
        contentHtml: "<p>Content</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe("");
    });

    it("should handle missing date", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Test Title",
        dateText: "",
        contentHtml: "<p>Content</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.dateText).toBe("");
    });

    it("should handle empty content", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Test Title",
        dateText: "2026-02-02",
        contentHtml: "",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.contentHtml).toBe("");
    });

    it("should extract complex HTML content", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Complex Post",
        dateText: "2026-02-02",
        contentHtml: `
          <div>
            <h2>Section 1</h2>
            <p>Paragraph 1</p>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
            </ul>
          </div>
        `,
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.contentHtml).toContain("<h2>Section 1</h2>");
      expect(details.contentHtml).toContain("<ul>");
    });
  });
});
