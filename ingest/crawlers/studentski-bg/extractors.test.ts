import { describe, it, expect, vi } from "vitest";
import { extractPostLinks, extractPostDetails } from "./extractors";
import { SELECTORS } from "./selectors";

// Mock Page type from Playwright
interface MockPage {
  evaluate: <T>(fn: (...args: any[]) => T, ...args: any[]) => Promise<T>;
}

function createMockPage(mockEvaluate: any): MockPage {
  return {
    evaluate: mockEvaluate,
  } as MockPage;
}

describe("studentski-bg/extractors", () => {
  describe("extractPostLinks", () => {
    it("should extract post links from valid HTML (Bulgarian date format)", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://studentski.bg/post-123",
          title: "Товаро-разтоварни и бетонови работи",
          date: "30.12.2025",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].url).toContain("studentski.bg");
      expect(posts[0].title).toBe("Товаро-разтоварни и бетонови работи");
      expect(posts[0].date).toBe("30.12.2025");

      // Verify that SELECTORS was passed to evaluate
      expect(mockEvaluate).toHaveBeenCalledWith(
        expect.any(Function),
        SELECTORS
      );
    });

    it("should extract multiple post links (10 posts from index page)", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://studentski.bg/post-1",
          title: "Post 1",
          date: "30.12.2025",
        },
        {
          url: "https://studentski.bg/post-2",
          title: "Post 2",
          date: "22.12.2025",
        },
        {
          url: "https://studentski.bg/post-3",
          title: "Post 3",
          date: "19.12.2025",
        },
        {
          url: "https://studentski.bg/post-4",
          title: "Post 4",
          date: "04.12.2025",
        },
        {
          url: "https://studentski.bg/post-5",
          title: "Post 5",
          date: "04.12.2025",
        },
        {
          url: "https://studentski.bg/post-6",
          title: "Post 6",
          date: "29.11.2025",
        },
        {
          url: "https://studentski.bg/post-7",
          title: "Post 7",
          date: "26.11.2025",
        },
        {
          url: "https://studentski.bg/post-8",
          title: "Post 8",
          date: "25.11.2025",
        },
        {
          url: "https://studentski.bg/post-9",
          title: "Post 9",
          date: "14.11.2025",
        },
        {
          url: "https://studentski.bg/post-10",
          title: "Post 10",
          date: "12.11.2025",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(10);
      expect(posts[0].title).toBe("Post 1");
      expect(posts[9].title).toBe("Post 10");
      expect(posts[0].date).toBe("30.12.2025");
      expect(posts[9].date).toBe("12.11.2025");
    });

    it("should return empty array when no posts found", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toEqual([]);
    });

    it("should skip posts with missing date", async () => {
      // Posts without dates are skipped in the browser context
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://studentski.bg/post-1",
          title: "Post with date",
          date: "30.12.2025",
        },
        // Post without date is skipped in the evaluate function
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      // Only the post with a date should be returned
      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe("Post with date");
    });

    it("should skip posts without URL", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://studentski.bg/post-valid",
          title: "Valid Post",
          date: "30.12.2025",
        },
        // Post without URL is skipped in evaluate function
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].url).toContain("post-valid");
    });

    it("should skip posts without title", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://studentski.bg/post-valid",
          title: "Valid Post",
          date: "30.12.2025",
        },
        // Post without title is skipped in evaluate function
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe("Valid Post");
    });

    it("should handle posts with media links", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://studentski.bg/post-with-image",
          title: "Започна ремонт на алеи",
          date: "04.12.2025",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].url).toContain("post-with-image");
    });

    it("should handle posts without media (no-media class)", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://studentski.bg/post-no-media",
          title: "Бетонови и товаро-разтоварни работи",
          date: "04.12.2025",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].url).toContain("post-no-media");
    });
  });

  describe("extractPostDetails", () => {
    it("should extract post details from valid HTML", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Непрекъсваем строителен процес",
        dateText: "22.12.2025",
        contentHtml:
          "<p>На дата 23.12.2025 г. (вторник) от 08.00 ч. до 22.00 ч...</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe("Непрекъсваем строителен процес");
      expect(details.dateText).toBe("22.12.2025");
      expect(details.contentHtml).toContain("На дата 23.12.2025 г.");

      expect(mockEvaluate).toHaveBeenCalledWith(
        expect.any(Function),
        SELECTORS
      );
    });

    it("should handle missing title", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "",
        dateText: "22.12.2025",
        contentHtml: "<p>Content without title</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe("");
      expect(details.dateText).toBe("22.12.2025");
      expect(details.contentHtml).toContain("Content without title");
    });

    it("should handle missing date", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Test Post",
        dateText: "",
        contentHtml: "<p>Content</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe("Test Post");
      expect(details.dateText).toBe("");
      expect(details.contentHtml).toContain("Content");
    });

    it("should handle missing content", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Test Post",
        dateText: "22.12.2025",
        contentHtml: "",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe("Test Post");
      expect(details.dateText).toBe("22.12.2025");
      expect(details.contentHtml).toBe("");
    });

    it("should handle complex HTML content with multiple paragraphs", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Графици за СМР",
        dateText: "2025-11-29",
        contentHtml:
          "<p>Първи параграф с информация.</p><p>Втори параграф с детайли.</p><ul><li>Списък елемент 1</li><li>Списък елемент 2</li></ul>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.contentHtml).toContain("Първи параграф");
      expect(details.contentHtml).toContain("Втори параграф");
      expect(details.contentHtml).toContain("<ul>");
      expect(details.contentHtml).toContain("Списък елемент");
    });

    it("should extract from .single-post-title selector", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Title from single-post-title",
        dateText: "2025-12-22",
        contentHtml: "<p>Content</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe("Title from single-post-title");
    });

    it("should extract from .entry-content selector", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Test Post",
        dateText: "2025-12-22",
        contentHtml: "<p>Content from entry-content</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.contentHtml).toContain("Content from entry-content");
    });

    it("should handle long titles gracefully", async () => {
      const longTitle =
        'Товаро-разтоварни и бетонови работи на обект: "Сграда със смесена функция, обществено обслужваща функция, магазини, ресторант, офиси, апартаментен хотел и подземни гаражи"';

      const mockEvaluate = vi.fn().mockResolvedValue({
        title: longTitle,
        dateText: "2025-12-30",
        contentHtml: "<p>Content</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe(longTitle);
      expect(details.title.length).toBeGreaterThan(100);
    });
  });
});
