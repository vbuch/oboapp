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

describe("lozenets-sofia-bg/extractors", () => {
  describe("extractPostLinks", () => {
    it("should extract post links from valid HTML", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://lozenets.sofia.bg/test-post/",
          title: "Test Post",
          date: "21.01.2026",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].url).toContain("lozenets.sofia.bg");
      expect(posts[0].title).toBe("Test Post");
      expect(posts[0].date).toBe("21.01.2026");
    });

    it("should extract multiple post links", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://lozenets.sofia.bg/post-1/",
          title: "Post 1",
          date: "21.01.2026",
        },
        {
          url: "https://lozenets.sofia.bg/post-2/",
          title: "Post 2",
          date: "16.01.2026",
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

    it("should handle posts with empty dates", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://lozenets.sofia.bg/test-post/",
          title: "Test Post",
          date: "",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].date).toBe("");
    });

    it("should handle posts with missing title", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://lozenets.sofia.bg/test-post/",
          title: "",
          date: "21.01.2026",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe("");
    });
  });

  describe("extractPostDetails", () => {
    it("should extract post details from valid HTML", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Test Post Title",
        dateText: "29.12.2025",
        contentHtml: "<p>This is the main content</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe("Test Post Title");
      expect(details.dateText).toBe("29.12.2025");
      expect(details.contentHtml).toContain("main content");
    });

    it("should extract content without social share buttons", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Test Post",
        dateText: "29.12.2025",
        contentHtml: "<p>Content only</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.contentHtml).not.toContain("wpex-social-share");
      expect(details.contentHtml).not.toContain("related-posts");
    });

    it("should handle empty content", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Test Post",
        dateText: "29.12.2025",
        contentHtml: "",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.contentHtml).toBe("");
    });

    it("should handle missing date", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Test Post",
        dateText: "",
        contentHtml: "<p>Content</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.dateText).toBe("");
    });

    it("should preserve HTML structure in content", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Test Post",
        dateText: "29.12.2025",
        contentHtml: "<div><p>Paragraph 1</p><ul><li>Item 1</li></ul></div>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.contentHtml).toContain("<p>");
      expect(details.contentHtml).toContain("<ul>");
      expect(details.contentHtml).toContain("<li>");
    });
  });
});
