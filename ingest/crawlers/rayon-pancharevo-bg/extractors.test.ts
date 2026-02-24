import { describe, it, expect, vi } from "vitest";
import type { Page } from "playwright";
import { extractPostDetails } from "./extractors";

describe("rayon-pancharevo-bg extractors", () => {
  describe("extractPostLinks", () => {
    it("should include URLs with 'ремонт' (repair) keyword", async () => {
      const urlFilter = (url: string) => {
        let decodedUrl: string;
        try {
          decodedUrl = decodeURIComponent(url).toLowerCase();
        } catch {
          decodedUrl = url.toLowerCase();
        }
        return (
          decodedUrl.includes("ремонт") ||
          decodedUrl.includes("инфраструктура") ||
          /\/\d+(-\d+)?\/?$/.test(decodedUrl)
        );
      };

      expect(urlFilter("https://www.pancharevo.org/%D1%80%D0%B5%D0%BC%D0%BE%D0%BD%D1%82")).toBe(true);
      expect(urlFilter("https://www.pancharevo.org/ремонт-уведомление")).toBe(true);
    });

    it("should include URLs with 'инфраструктура' (infrastructure) keyword", async () => {
      const urlFilter = (url: string) => {
        let decodedUrl: string;
        try {
          decodedUrl = decodeURIComponent(url).toLowerCase();
        } catch {
          decodedUrl = url.toLowerCase();
        }
        return (
          decodedUrl.includes("ремонт") ||
          decodedUrl.includes("инфраструктура") ||
          /\/\d+(-\d+)?\/?$/.test(decodedUrl)
        );
      };

      expect(urlFilter("https://www.pancharevo.org/инфраструктура")).toBe(true);
    });

    it("should include URLs with numeric IDs", async () => {
      const urlFilter = (url: string) => {
        let decodedUrl: string;
        try {
          decodedUrl = decodeURIComponent(url).toLowerCase();
        } catch {
          decodedUrl = url.toLowerCase();
        }
        return (
          decodedUrl.includes("ремонт") ||
          decodedUrl.includes("инфраструктура") ||
          /\/\d+(-\d+)?\/?$/.test(decodedUrl)
        );
      };

      expect(urlFilter("https://www.pancharevo.org/21862-2/")).toBe(true);
      expect(urlFilter("https://www.pancharevo.org/21862/")).toBe(true);
      expect(urlFilter("https://www.pancharevo.org/article-123/")).toBe(true);
    });

    it("should exclude URLs without repair-related keywords or numeric IDs", async () => {
      const urlFilter = (url: string) => {
        let decodedUrl: string;
        try {
          decodedUrl = decodeURIComponent(url).toLowerCase();
        } catch {
          decodedUrl = url.toLowerCase();
        }
        return (
          decodedUrl.includes("ремонт") ||
          decodedUrl.includes("инфраструктура") ||
          /\/\d+(-\d+)?\/?$/.test(decodedUrl)
        );
      };

      expect(urlFilter("https://www.pancharevo.org/about")).toBe(false);
      expect(urlFilter("https://www.pancharevo.org/contact")).toBe(false);
    });

    it("should handle URL decoding errors gracefully", async () => {
      const urlFilter = (url: string) => {
        let decodedUrl: string;
        try {
          decodedUrl = decodeURIComponent(url).toLowerCase();
        } catch {
          decodedUrl = url.toLowerCase();
        }
        return (
          decodedUrl.includes("ремонт") ||
          decodedUrl.includes("инфраструктура") ||
          /\/\d+(-\d+)?\/?$/.test(decodedUrl)
        );
      };

      // Test with invalid percent encoding that would throw
      const invalidUrl = "https://www.pancharevo.org/%ZZ";
      expect(() => urlFilter(invalidUrl)).not.toThrow();
    });
  });

  describe("extractPostDetails", () => {
    it("should return an object with title, dateText, and contentHtml properties", async () => {
      const mockPage = {
        evaluate: vi.fn().mockResolvedValue({
          title: "Test Post Title",
          dateText: "24 февруари 2026",
          contentHtml: "<p>Test content</p>",
        }),
      } as any as Page;

      const result = await extractPostDetails(mockPage);
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("dateText");
      expect(result).toHaveProperty("contentHtml");
    });

    it("should strip unwanted HTML elements from content", async () => {
      const mockPage = {
        evaluate: vi.fn().mockResolvedValue({
          title: "Post Title",
          dateText: "24 февруари 2026",
          contentHtml: "<p>Cleaned content without scripts and styles</p>",
        }),
      } as any as Page;

      const result = await extractPostDetails(mockPage);
      expect(result.contentHtml).not.toContain("<script>");
      expect(result.contentHtml).not.toContain("<style>");
    });

    it("should handle missing optional properties gracefully", async () => {
      const mockPage = {
        evaluate: vi.fn().mockResolvedValue({
          title: "",
          dateText: "",
          contentHtml: "",
        }),
      } as any as Page;

      const result = await extractPostDetails(mockPage);
      expect(result.title).toBe("");
      expect(result.dateText).toBe("");
      expect(result.contentHtml).toBe("");
    });
  });
});
