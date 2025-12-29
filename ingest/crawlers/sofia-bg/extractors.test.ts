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

describe("sofia-bg/extractors", () => {
  describe("extractPostLinks", () => {
    it("should extract post links from valid HTML", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://www.sofia.bg/w/article-123",
          title: "Ремонт на улица",
          date: "20 декември 2025",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].url).toContain("sofia.bg/w/");
      expect(posts[0].title).toBe("Ремонт на улица");
      expect(posts[0].date).toBe("20 декември 2025");

      // Verify that SELECTORS was passed to evaluate
      expect(mockEvaluate).toHaveBeenCalledWith(
        expect.any(Function),
        SELECTORS
      );
    });

    it("should extract multiple post links", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://www.sofia.bg/w/article-1",
          title: "Post 1",
          date: "20 декември 2025",
        },
        {
          url: "https://www.sofia.bg/w/article-2",
          title: "Post 2",
          date: "19 декември 2025",
        },
        {
          url: "https://www.sofia.bg/w/article-3",
          title: "Post 3",
          date: "18 декември 2025",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(3);
      expect(posts[0].title).toBe("Post 1");
      expect(posts[1].title).toBe("Post 2");
      expect(posts[2].title).toBe("Post 3");
    });

    it("should return empty array when no posts found", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toEqual([]);
    });

    it("should handle posts without dates", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://www.sofia.bg/w/article-123",
          title: "Test Post",
          date: "",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].date).toBe("");
    });

    it("should only extract valid URLs", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://www.sofia.bg/w/valid-article",
          title: "Valid",
          date: "20 декември 2025",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].url).toMatch(/^https:\/\/www\.sofia\.bg\/w\//);
    });
  });

  describe("extractPostDetails", () => {
    it("should extract post details from valid page", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Временна организация на движението",
        dateText: "20 декември 2025",
        contentHtml: "<div><p>Content paragraph</p></div>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe("Временна организация на движението");
      expect(details.dateText).toBe("20 декември 2025");
      expect(details.contentHtml).toBe("<div><p>Content paragraph</p></div>");

      // Verify SELECTORS passed
      expect(mockEvaluate).toHaveBeenCalledWith(
        expect.any(Function),
        SELECTORS
      );
    });

    it("should extract title from component-paragraph", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Title from component-paragraph",
        dateText: "20 декември 2025",
        contentHtml: "<div>Content</div>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe("Title from component-paragraph");
    });

    it("should handle fallback to h1 for title", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Fallback H1 Title",
        dateText: "20 декември 2025",
        contentHtml: "<div>Content</div>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe("Fallback H1 Title");
    });

    it("should handle missing title", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "",
        dateText: "20 декември 2025",
        contentHtml: "<div>Content</div>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe("");
    });

    it("should handle missing date", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Test Title",
        dateText: "",
        contentHtml: "<div>Content</div>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.dateText).toBe("");
    });

    it("should handle empty content", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Test Title",
        dateText: "20 декември 2025",
        contentHtml: "",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.contentHtml).toBe("");
    });

    it("should extract complex HTML with multiple component-paragraphs", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Multi-paragraph Article",
        dateText: "20 декември 2025",
        contentHtml: `
          <div class="component-paragraph">
            <p>First paragraph</p>
          </div>
          <div class="component-paragraph">
            <p>Second paragraph</p>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
            </ul>
          </div>
        `,
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.contentHtml).toContain("First paragraph");
      expect(details.contentHtml).toContain("Second paragraph");
      expect(details.contentHtml).toContain("<ul>");
    });

    it("should handle all fields being empty", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "",
        dateText: "",
        contentHtml: "",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe("");
      expect(details.dateText).toBe("");
      expect(details.contentHtml).toBe("");
    });
  });
});
