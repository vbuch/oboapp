import { describe, it, expect, vi } from "vitest";
import { extractPostLinks, extractPostDetails } from "./extractors";
import { SELECTORS } from "./selectors";

interface MockPage {
  evaluate: <T>(fn: (...args: any[]) => T, ...args: any[]) => Promise<T>;
}

function createMockPage(mockEvaluate: any): MockPage {
  return {
    evaluate: mockEvaluate,
  } as MockPage;
}

describe("sofia-capital-of-sport/extractors", () => {
  describe("extractPostLinks", () => {
    it("should extract event links", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://sofia2018.bg/event/sofia-half-marathon-2026/",
          title: "Sofia Half Marathon 2026",
          date: "април 5",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].url).toContain("/event/");
      expect(posts[0].title).toBe("Sofia Half Marathon 2026");
      expect(mockEvaluate).toHaveBeenCalledWith(
        expect.any(Function),
        SELECTORS,
      );
    });

    it("should return empty array when no events are found", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toEqual([]);
    });
  });

  describe("extractPostDetails", () => {
    it("should extract event details", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Sofia Half Marathon 2026",
        dateText: "април 5",
        contentHtml: "<p>Event description</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe("Sofia Half Marathon 2026");
      expect(details.dateText).toBe("април 5");
      expect(details.contentHtml).toContain("Event description");
      expect(mockEvaluate).toHaveBeenCalledWith(expect.any(Function), {
        selectors: SELECTORS.POST,
        unwantedElements: [
          "script",
          "style",
          "nav",
          "header",
          "footer",
          ".tribe-events-c-subscribe-dropdown",
          ".tribe-events-event-meta",
          ".sharedaddy",
        ],
        rootSelector: "#tribe-events-content",
      });
    });
  });
});
