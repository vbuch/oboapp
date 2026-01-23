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

describe("so-slatina-org/extractors", () => {
  describe("extractPostLinks", () => {
    it("should extract post links from homepage HTML", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://so-slatina.org/2026/01/test-post/",
          title: "Test Post Title",
          date: "",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].url).toContain("so-slatina.org/20");
      expect(posts[0].title).toBeTruthy();
    });

    it("should extract multiple post links from homepage", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://so-slatina.org/2026/01/post-1/",
          title: "Post 1",
          date: "",
        },
        {
          url: "https://so-slatina.org/2026/01/post-2/",
          title: "Post 2",
          date: "",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(2);
      expect(posts[0].url).toContain("so-slatina.org/20");
      expect(posts[1].url).toContain("so-slatina.org/20");
    });

    it("should return empty array when no posts found", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toEqual([]);
    });

    it("should filter posts by URL pattern (must contain year in path)", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://so-slatina.org/2026/01/test-post/",
          title: "Valid Post with Year",
          date: "",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].url).toMatch(/\/20\d{2}\//); // Contains /20XX/
    });
  });

  describe("extractPostDetails", () => {
    it("should extract post details from article page", async () => {
      const mockEvaluate = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          title: "Test Article Title",
          dateText: "15/01/2026 16:16",
          contentHtml: "<p>Article content here.</p>",
        });
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBeTruthy();
      expect(details.dateText).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/); // DD/MM/YYYY HH:MM format
      expect(details.contentHtml).toContain("<p>");
    });

    it("should handle posts with minimal content", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Short Post",
        dateText: "15/01/2026 10:00",
        contentHtml: "<p>Short content</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe("Short Post");
      expect(details.dateText).toBe("15/01/2026 10:00");
      expect(details.contentHtml).toBe("<p>Short content</p>");
    });

    it("should extract date in DD/MM/YYYY HH:MM format", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Test Post",
        dateText: "23/01/2026 14:30",
        contentHtml: "<p>Test content</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.dateText).toBe("23/01/2026 14:30");
      // Verify format matches expected pattern
      expect(details.dateText).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    });
  });
});
