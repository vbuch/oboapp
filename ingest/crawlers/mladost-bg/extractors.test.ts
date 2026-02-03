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

describe("mladost-bg/extractors", () => {
  describe("extractPostLinks", () => {
    it("should extract post links with Bulgarian month dates from Joomla structure", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://mladost.bg/gradska-i-okolna-sreda/planovi-remonti/avariyno-remontni-raboti-na-toplofikatsiya-na-ul-badnina",
          title: "Аварийно-ремонтни работи на топлофикация на ул. Бъднина",
          date: "20 Октомври 2025",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].url).toContain("/planovi-remonti/");
      expect(posts[0].title).toBe(
        "Аварийно-ремонтни работи на топлофикация на ул. Бъднина",
      );
      expect(posts[0].date).toBe("20 Октомври 2025");
    });

    it("should extract multiple post links from article.blog-card elements", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://mladost.bg/gradska-i-okolna-sreda/planovi-remonti/remont-severen-trotoar-na-ul-bozhan-angelov",
          title: "Ремонт северен тротоар на ул. Божан Ангелов",
          date: "19 септември 2025",
        },
        {
          url: "https://mladost.bg/gradska-i-okolna-sreda/planovi-remonti/neplanirano-spirane-na-vodopodavane",
          title: "НЕПЛАНИРАНО СПИРАНЕ НА ВОДОПОДАВАНЕ",
          date: "27 август 2025",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(2);
      expect(posts[0].title).toBe(
        "Ремонт северен тротоар на ул. Божан Ангелов",
      );
      expect(posts[0].date).toBe("19 септември 2025");
      expect(posts[1].title).toBe("НЕПЛАНИРАНО СПИРАНЕ НА ВОДОПОДАВАНЕ");
      expect(posts[1].date).toBe("27 август 2025");
    });

    it("should return empty array when no posts found", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toEqual([]);
    });

    it("should filter posts by /planovi-remonti/ URL pattern", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://mladost.bg/gradska-i-okolna-sreda/planovi-remonti/remont-v-podlez",
          title: "Valid Post",
          date: "17 Юли 2025",
        },
        {
          url: "https://mladost.bg/gradska-i-okolna-sreda/news/something-else",
          title: "Invalid Post",
          date: "17 Юли 2025",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      // URL filter should remove non-planovi-remonti posts
      expect(posts).toHaveLength(1);
      expect(posts.every((p) => p.url.includes("/planovi-remonti/"))).toBe(
        true,
      );
    });

    it("should handle posts with empty dates", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://mladost.bg/gradska-i-okolna-sreda/planovi-remonti/test-post",
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
    it("should extract post details from Joomla article page", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Аварийно-ремонтни работи на топлофикация на ул. Бъднина",
        dateText: "20 Октомври 2025",
        contentHtml:
          "<p><strong>УВАЖАЕМИ ГРАЖДАНИ,</strong></p><p>Във връзка с изпълнение на авариен ремонт...</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe(
        "Аварийно-ремонтни работи на топлофикация на ул. Бъднина",
      );
      expect(details.dateText).toBe("20 Октомври 2025");
      expect(details.contentHtml).toContain("УВАЖАЕМИ ГРАЖДАНИ");
    });

    it("should extract title from h1.article-title element", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Title from h1",
        dateText: "14 Октомври 2025",
        contentHtml: "<p>Content</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe("Title from h1");
    });

    it("should extract content from div.article-body", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Test Title",
        dateText: "20 Октомври 2025",
        contentHtml: "<p>Article body content</p><p>Multiple paragraphs</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.contentHtml).toContain("Article body content");
      expect(details.contentHtml).toContain("Multiple paragraphs");
    });

    it("should handle missing title", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "",
        dateText: "20 Октомври 2025",
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
        dateText: "20 Октомври 2025",
        contentHtml: "",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.contentHtml).toBe("");
    });

    it("should use extractPostDetailsGeneric with correct selectors", async () => {
      // Verify that SELECTORS.POST is being used
      expect(SELECTORS.POST.TITLE).toBe("h1.article-title");
      expect(SELECTORS.POST.DATE).toBe("time");
      expect(SELECTORS.POST.CONTENT).toBe("div.article-body");
    });
  });
});
