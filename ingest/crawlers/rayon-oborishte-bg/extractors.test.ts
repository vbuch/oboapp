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

describe("rayon-oborishte-bg/extractors", () => {
  describe("extractPostLinks", () => {
    it("should extract post links from valid HTML", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://rayon-oborishte.bg/%d1%83%d0%b2%d0%b5%d0%b4%d0%be%d0%bc%d0%bb%d0%b5%d0%bd%d0%b8%d0%b5-test",
          title: "Test Post",
          date: "15 декември 2025",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].url).toContain("rayon-oborishte.bg");
      expect(posts[0].title).toBe("Test Post");
      expect(posts[0].date).toBe("15 декември 2025");
    });

    it("should extract multiple post links", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://rayon-oborishte.bg/%d1%83%d0%b2%d0%b5%d0%b4%d0%be%d0%bc%d0%bb%d0%b5%d0%bd%d0%b8%d0%b5-1",
          title: "Post 1",
          date: "15 декември 2025",
        },
        {
          url: "https://rayon-oborishte.bg/%d1%83%d0%b2%d0%b5%d0%b4%d0%be%d0%bc%d0%bb%d0%b5%d0%bd%d0%b8%d0%b5-2",
          title: "Post 2",
          date: "14 декември 2025",
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

    it("should filter posts by URL pattern (must contain specific path)", async () => {
      // The extractor should only extract links with the specific URL pattern
      const mockEvaluate = vi.fn().mockImplementation((fn) => {
        // Simulate the actual DOM filtering logic
        const validPost = {
          url: "https://rayon-oborishte.bg/%d1%83%d0%b2%d0%b5%d0%b4%d0%be%d0%bc%d0%bb%d0%b5%d0%bd%d0%b8%d0%b5-test",
          title: "Valid Post",
          date: "15 декември 2025",
        };
        return Promise.resolve([validPost]);
      });

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].url).toContain(
        "%d1%83%d0%b2%d0%b5%d0%b4%d0%be%d0%bc%d0%bb%d0%b5%d0%bd%d0%b8%d0%b5-",
      );
    });

    it("should handle posts with empty dates", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://rayon-oborishte.bg/%d1%83%d0%b2%d0%b5%d0%b4%d0%be%d0%bc%d0%bb%d0%b5%d0%bd%d0%b8%d0%b5-test",
          title: "Test Post",
          date: "",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].date).toBe("");
    });

    it("should accept URLs containing 'ремонт' (repair)", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://rayon-oborishte.bg/%d0%bf%d0%be%d0%b5%d1%82%d0%b0%d0%bf%d0%bd%d0%b8-%d1%80%d0%b5%d0%bc%d0%be%d0%bd%d1%82%d0%bd%d0%b8-%d0%b4%d0%b5%d0%b9%d0%bd%d0%be%d1%81%d1%82%d0%b8/",
          title: "Поетапни ремонтни дейности",
          date: "05 февруари 2026",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe("Поетапни ремонтни дейности");
    });

    it("should accept URLs containing 'затваряни' (closing)", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://rayon-oborishte.bg/%d0%b7%d0%b0%d1%82%d0%b2%d0%b0%d1%80%d1%8f%d0%bd%d0%b8%d1%8f-%d0%bd%d0%b0-%d1%83%d0%bb%d0%b8%d1%86%d0%b0/",
          title: "Затваряния на улица",
          date: "04 февруари 2026",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe("Затваряния на улица");
    });

    it("should accept URLs with numeric IDs like /21862-2/", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://rayon-oborishte.bg/21862-2/",
          title: "Уведомление за строителни дейности",
          date: "05 февруари 2026",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe("Уведомление за строителни дейности");
    });

    it("should accept URLs with simple numeric IDs like /12345/", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://rayon-oborishte.bg/12345/",
          title: "Some Post",
          date: "03 февруари 2026",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
    });

    it("should filter out navigation pages like 'контакти'", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://rayon-oborishte.bg/%d0%ba%d0%be%d0%bd%d1%82%d0%b0%d0%ba%d1%82%d0%b8/",
          title: "Контакти",
          date: "",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(0);
    });

    it("should filter out navigation pages like 'администрация'", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://rayon-oborishte.bg/%d0%b0%d0%b4%d0%bc%d0%b8%d0%bd%d0%b8%d1%81%d1%82%d1%80%d0%b0%d1%86%d0%b8%d1%8f/",
          title: "Администрация",
          date: "",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(0);
    });

    it("should correctly filter mixed valid and invalid URLs", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://rayon-oborishte.bg/%d1%83%d0%b2%d0%b5%d0%b4%d0%be%d0%bc%d0%bb%d0%b5%d0%bd%d0%b8%d0%b5-1/",
          title: "Valid: уведомление",
          date: "05 февруари 2026",
        },
        {
          url: "https://rayon-oborishte.bg/%d0%ba%d0%be%d0%bd%d1%82%d0%b0%d0%ba%d1%82%d0%b8/",
          title: "Invalid: контакти",
          date: "",
        },
        {
          url: "https://rayon-oborishte.bg/%d1%80%d0%b5%d0%bc%d0%be%d0%bd%d1%82-test/",
          title: "Valid: ремонт",
          date: "04 февруари 2026",
        },
        {
          url: "https://rayon-oborishte.bg/21862-2/",
          title: "Valid: numeric ID",
          date: "03 февруари 2026",
        },
        {
          url: "https://rayon-oborishte.bg/%d0%bf%d0%b0%d1%80%d1%82%d0%bd%d1%8c%d0%be%d1%80%d0%b8/",
          title: "Invalid: партньори",
          date: "",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(3);
      expect(posts.map((p) => p.title)).toEqual([
        "Valid: уведомление",
        "Valid: ремонт",
        "Valid: numeric ID",
      ]);
    });
  });

  describe("extractPostDetails", () => {
    it("should extract post details from valid page", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Уведомление за ремонт",
        dateText: "15 декември 2025",
        contentHtml: "<p>Test content</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe("Уведомление за ремонт");
      expect(details.dateText).toBe("15 декември 2025");
      expect(details.contentHtml).toBe("<p>Test content</p>");
    });

    it("should handle missing title", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "",
        dateText: "15 декември 2025",
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
        dateText: "15 декември 2025",
        contentHtml: "",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.contentHtml).toBe("");
    });

    it("should extract complex HTML content", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Complex Post",
        dateText: "15 декември 2025",
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
