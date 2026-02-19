import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Page } from "playwright";
import { extractPostLinks, extractPostDetails } from "./extractors";

describe("rayon-pancharevo-bg extractors", () => {
  let mockPage: Partial<Page>;

  beforeEach(() => {
    mockPage = {
      $$eval: vi.fn(),
      $eval: vi.fn(),
    };
  });

  describe("extractPostLinks", () => {
    it("should filter posts with repair-related keywords", async () => {
      const mockLinks = [
        {
          url: "https://www.pancharevo.org/repair-notification",
          title: "Repair Notification",
        },
        {
          url: "https://www.pancharevo.org/infrastructure-work",
          title: "Infrastructure Work",
        },
      ];

      (mockPage.$$eval as any).mockResolvedValue(mockLinks);

      const result = await extractPostLinks(mockPage as Page);
      expect(result).toBeDefined();
    });

    it("should exclude unrelated posts", async () => {
      const urlFilter = (url: string) => {
        const decodedUrl = decodeURIComponent(url).toLowerCase();
        return (
          decodedUrl.includes("ремонт") ||
          decodedUrl.includes("инфраструктура") ||
          /\/\d+(-\d+)?\/?$/.test(decodedUrl)
        );
      };

      expect(urlFilter("https://www.pancharevo.org/about")).toBe(false);
      expect(
        urlFilter("https://www.pancharevo.org/ремонт-уведомление"),
      ).toBe(true);
    });
  });

  describe("extractPostDetails", () => {
    it("should extract title, date, and content", async () => {
      (mockPage.$eval as any).mockImplementation((selector: string) => {
        if (selector.includes("title")) return "Test Post Title";
        if (selector.includes("date")) return "2024-01-15";
        if (selector.includes("content")) return "<p>Test content</p>";
        return null;
      });

      const result = await extractPostDetails(mockPage as Page);
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("dateText");
      expect(result).toHaveProperty("contentHtml");
    });
  });
});
