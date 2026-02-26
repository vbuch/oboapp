import { describe, it, expect, vi } from "vitest";
import { extractPostLinks, extractPostDetails } from "./extractors";

interface MockPage {
  evaluate: <T>(fn: (...args: unknown[]) => T, ...args: unknown[]) => Promise<T>;
}

function createMockPage(mockEvaluate: MockPage["evaluate"]): MockPage {
  return {
    evaluate: mockEvaluate,
  };
}

describe("rayon-pancharevo-bg/extractors", () => {
  describe("extractPostLinks", () => {
    it("extracts valid pancharevo post links", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://www.pancharevo.org/ремонти-и-инфраструктура/2300-ремонт-на-улица",
          title: "Ремонт на улица",
          date: "25.02.2026",
        },
      ]);

      const page = createMockPage(mockEvaluate) as unknown as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].url).toContain("pancharevo.org");
      expect(posts[0].title).toBe("Ремонт на улица");
    });

    it("returns empty array when no posts found", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([]);

      const page = createMockPage(mockEvaluate) as unknown as any;
      const posts = await extractPostLinks(page);

      expect(posts).toEqual([]);
    });

    it("filters out non-infrastructure URLs", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://www.pancharevo.org/контакти",
          title: "Контакти",
          date: "",
        },
      ]);

      const page = createMockPage(mockEvaluate) as unknown as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(0);
    });

    it("accepts numeric ID posts", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://www.pancharevo.org/ремонти-и-инфраструктура/21862-2/",
          title: "Инфраструктурни дейности",
          date: "24.02.2026",
        },
      ]);

      const page = createMockPage(mockEvaluate) as unknown as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].url).toContain("21862-2");
    });

    it("filters out pagination/listing URLs", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://www.pancharevo.org/ремонти-и-инфраструктура?start=4",
          title: "РЕМОНТИ И ИНФРАСТРУКТУРА",
          date: "",
        },
      ]);

      const page = createMockPage(mockEvaluate) as unknown as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(0);
    });
  });

  describe("extractPostDetails", () => {
    it("uses extracted date when available", async () => {
      const mockEvaluate = vi
        .fn()
        .mockResolvedValueOnce({
          title: "Предстоящо спиране на водоподаването на 27 януари 2026 г.",
          dateText: "27 януари (вторник) 2026 г.",
          contentHtml: "<p>Съдържание</p>",
        });

      const page = createMockPage(mockEvaluate) as unknown as any;
      const details = await extractPostDetails(page);

      expect(details.dateText).toBe("27 януари (вторник) 2026 г.");
      expect(mockEvaluate).toHaveBeenCalledTimes(1);
    });

    it("falls back to title when date selector is empty", async () => {
      const mockEvaluate = vi
        .fn()
        .mockResolvedValueOnce({
          title: "Предстоящо спиране на водоподаването на 27 януари 2026 г. в с. Лозен",
          dateText: "",
          contentHtml: "<p>На 27 януари 2026 г. ...</p>",
        })
        .mockResolvedValueOnce("На 27 януари 2026 г. ...");

      const page = createMockPage(mockEvaluate) as unknown as any;
      const details = await extractPostDetails(page);

      expect(details.dateText).toContain("27 януари 2026");
      expect(mockEvaluate).toHaveBeenCalledTimes(2);
    });
  });
});
