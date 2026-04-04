import { describe, expect, it, vi } from "vitest";
import type { Page } from "playwright";
import { extractPostLinks, extractPostDetailsGeneric } from "./extractors";

describe("shared/extractors", () => {
  describe("extractPostLinks", () => {
    it("should extract post links from page", async () => {
      const mockPosts = [
        {
          url: "https://example.com/post-1",
          title: "First Post",
          date: "1 януари 2025",
        },
        {
          url: "https://example.com/post-2",
          title: "Second Post",
          date: "2 януари 2025",
        },
      ];

      const mockPage = {
        evaluate: vi.fn().mockResolvedValue(mockPosts),
      } as unknown as Page;

      const selectors = {
        INDEX: {
          POST_CONTAINER: ".post",
          POST_LINK: "a",
          POST_TITLE: "h2",
          POST_DATE: ".date",
        },
        POST: {
          TITLE: "h1",
          DATE: ".date",
        },
      };

      const result = await extractPostLinks(mockPage, selectors);

      expect(result).toEqual(mockPosts);
      expect(mockPage.evaluate).toHaveBeenCalledWith(
        expect.any(Function),
        selectors,
      );
    });

    it("should filter posts using urlFilter", async () => {
      const mockPosts = [
        {
          url: "https://example.com/announcement-1",
          title: "Announcement",
          date: "1 януари 2025",
        },
        {
          url: "https://example.com/category/general",
          title: "Category",
          date: "2 януари 2025",
        },
        {
          url: "https://example.com/announcement-2",
          title: "Another Announcement",
          date: "3 януари 2025",
        },
      ];

      const mockPage = {
        evaluate: vi.fn().mockResolvedValue(mockPosts),
      } as unknown as Page;

      const selectors = {
        INDEX: {
          POST_CONTAINER: ".post",
          POST_LINK: "a",
          POST_TITLE: "h2",
          POST_DATE: ".date",
        },
        POST: {
          TITLE: "h1",
          DATE: ".date",
        },
      };

      const urlFilter = (url: string) => url.includes("announcement");

      const result = await extractPostLinks(mockPage, selectors, urlFilter);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("Announcement");
      expect(result[1].title).toBe("Another Announcement");
    });

    it("should return empty array when no posts found", async () => {
      const mockPage = {
        evaluate: vi.fn().mockResolvedValue([]),
      } as unknown as Page;

      const selectors = {
        INDEX: {
          POST_CONTAINER: ".post",
          POST_LINK: "a",
          POST_TITLE: "h2",
          POST_DATE: ".date",
        },
        POST: {
          TITLE: "h1",
          DATE: ".date",
        },
      };

      const result = await extractPostLinks(mockPage, selectors);

      expect(result).toEqual([]);
    });

    it("should filter out all posts when urlFilter rejects all", async () => {
      const mockPosts = [
        {
          url: "https://example.com/post-1",
          title: "First Post",
          date: "1 януари 2025",
        },
        {
          url: "https://example.com/post-2",
          title: "Second Post",
          date: "2 януари 2025",
        },
      ];

      const mockPage = {
        evaluate: vi.fn().mockResolvedValue(mockPosts),
      } as unknown as Page;

      const selectors = {
        INDEX: {
          POST_CONTAINER: ".post",
          POST_LINK: "a",
          POST_TITLE: "h2",
          POST_DATE: ".date",
        },
        POST: {
          TITLE: "h1",
          DATE: ".date",
        },
      };

      const urlFilter = () => false;

      const result = await extractPostLinks(mockPage, selectors, urlFilter);

      expect(result).toEqual([]);
    });
  });

  describe("extractPostDetailsGeneric", () => {
    it("should extract post details from page", async () => {
      const mockDetails = {
        title: "Test Article",
        dateText: "15.01.2025",
        contentHtml: "<p>Article content</p>",
      };

      const mockPage = {
        evaluate: vi.fn().mockResolvedValue(mockDetails),
      } as unknown as Page;

      const selectors = {
        TITLE: "h1",
        DATE: ".date",
        CONTENT: ".content",
      };

      const result = await extractPostDetailsGeneric(mockPage, selectors);

      expect(result).toEqual(mockDetails);
      expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), {
        selectors,
        unwantedElements: ["script", "style"],
        rootSelector: undefined,
      });
    });

    it("should use custom unwanted elements", async () => {
      const mockDetails = {
        title: "Test Article",
        dateText: "15.01.2025",
        contentHtml: "<p>Article content</p>",
      };

      const mockPage = {
        evaluate: vi.fn().mockResolvedValue(mockDetails),
      } as unknown as Page;

      const selectors = {
        TITLE: "h1",
        DATE: ".date",
        CONTENT: ".content",
      };

      const unwantedElements = ["script", "style", "nav", ".social-share"];

      const result = await extractPostDetailsGeneric(
        mockPage,
        selectors,
        unwantedElements,
      );

      expect(result).toEqual(mockDetails);
      expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), {
        selectors,
        unwantedElements,
        rootSelector: undefined,
      });
    });

    it("should pass root selector when provided", async () => {
      const mockDetails = {
        title: "Scoped title",
        dateText: "01.01.2026",
        contentHtml: "<p>Scoped content</p>",
      };

      const mockPage = {
        evaluate: vi.fn().mockResolvedValue(mockDetails),
      } as unknown as Page;

      const selectors = {
        TITLE: "h1",
        DATE: ".date",
        CONTENT: ".content",
      };

      const result = await extractPostDetailsGeneric(
        mockPage,
        selectors,
        ["script", "style"],
        "#content-root",
      );

      expect(result).toEqual(mockDetails);
      expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), {
        selectors,
        unwantedElements: ["script", "style"],
        rootSelector: "#content-root",
      });
    });

    it("should return empty strings when elements not found", async () => {
      const mockDetails = {
        title: "",
        dateText: "",
        contentHtml: "",
      };

      const mockPage = {
        evaluate: vi.fn().mockResolvedValue(mockDetails),
      } as unknown as Page;

      const selectors = {
        TITLE: "h1",
        DATE: ".date",
        CONTENT: ".content",
      };

      const result = await extractPostDetailsGeneric(mockPage, selectors);

      expect(result).toEqual(mockDetails);
    });
  });
});
