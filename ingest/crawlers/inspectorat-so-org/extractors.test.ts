import { describe, expect, it, vi } from "vitest";
import { extractPostDetails, extractPostLinks } from "./extractors";

interface MockPage {
  evaluate: <T>(fn: (...args: any[]) => T, ...args: any[]) => Promise<T>;
}

function createMockPage(mockEvaluate: any): MockPage {
  return {
    evaluate: mockEvaluate,
  } as MockPage;
}

describe("inspectorat-so-org/extractors", () => {
  describe("extractPostLinks", () => {
    it("extracts all valid news links", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://inspectorat-so.org/%D0%BD%D0%BE%D0%B2%D0%B8%D0%BD%D0%B8/?newsid=%D1%80%D0%B5%D0%BC%D0%BE%D0%BD%D1%82-%D0%BD%D0%B0-%D1%83%D0%BB%D0%B8%D1%86%D0%B0",
          title: "Ремонт на улица",
          date: "06апр.",
        },
        {
          url: "https://inspectorat-so.org/%D0%BD%D0%BE%D0%B2%D0%B8%D0%BD%D0%B8/?newsid=%D0%BF%D1%80%D0%B0%D0%B7%D0%BD%D0%B8%D0%BA-%D0%B2-%D0%BF%D0%B0%D1%80%D0%BA",
          title: "Празник в парк",
          date: "05апр.",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(2);
      expect(posts[0].title).toBe("Ремонт на улица");
      expect(posts[1].title).toBe("Празник в парк");
      expect(posts[0].url).toContain("newsid=");
    });

    it("deduplicates by URL", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://inspectorat-so.org/%D0%BD%D0%BE%D0%B2%D0%B8%D0%BD%D0%B8/?newsid=%D0%BC%D0%B8%D0%B5%D0%BD%D0%B5-%D0%BD%D0%B0-%D0%BF%D0%BE%D0%B4%D0%BB%D0%B5%D0%B7",
          title: "Първо",
          date: "06апр.",
        },
        {
          url: "https://inspectorat-so.org/%D0%BD%D0%BE%D0%B2%D0%B8%D0%BD%D0%B8/?newsid=%D0%BC%D0%B8%D0%B5%D0%BD%D0%B5-%D0%BD%D0%B0-%D0%BF%D0%BE%D0%B4%D0%BB%D0%B5%D0%B7",
          title: "Второ",
          date: "06апр.",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe("Второ");
    });

    it("returns empty array when there are no valid newsid URLs", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://inspectorat-so.org/%D0%BA%D0%BE%D0%BD%D1%82%D0%B0%D0%BA%D1%82%D0%B8",
          title: "Контакти",
          date: "01апр.",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toEqual([]);
    });
  });

  describe("extractPostDetails", () => {
    it("extracts title and content", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Миене на подлези с временно ограничение за движение",
        dateText: "",
        contentHtml: "<div>Текст на съобщението</div>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toContain("Миене на подлези");
      expect(details.contentHtml).toContain("Текст на съобщението");
      expect(details.dateText).toBe("");
    });
  });
});
