import { afterEach, describe, expect, it, vi } from "vitest";
import type { OboDb } from "@oboapp/db";

vi.mock("./firestore", () => ({
  isUrlProcessed: vi.fn(),
  saveSourceDocument: vi.fn(),
}));

describe("shared/rss-crawler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("filterUnprocessed", () => {
    it("returns only items not yet processed", async () => {
      const { isUrlProcessed } = await import("./firestore");
      vi.mocked(isUrlProcessed)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const { filterUnprocessed } = await import("./rss-crawler");

      const items = [
        {
          url: "https://example.com/a",
          title: "A",
          date: "2026-06-15T00:00:00.000Z",
        },
        {
          url: "https://example.com/b",
          title: "B",
          date: "2026-06-15T00:00:00.000Z",
        },
      ];

      const result = await filterUnprocessed(items, {} as OboDb, "test-source");
      expect(result).toHaveLength(1);
      expect(result[0].url).toBe("https://example.com/b");
    });

    it("returns all items when none have been processed", async () => {
      const { isUrlProcessed } = await import("./firestore");
      vi.mocked(isUrlProcessed).mockResolvedValue(false);

      const { filterUnprocessed } = await import("./rss-crawler");

      const items = [
        {
          url: "https://example.com/a",
          title: "A",
          date: "2026-06-15T00:00:00.000Z",
        },
        {
          url: "https://example.com/b",
          title: "B",
          date: "2026-06-15T00:00:00.000Z",
        },
      ];

      const result = await filterUnprocessed(items, {} as OboDb, "test-source");
      expect(result).toHaveLength(2);
    });

    it("skips item if isUrlProcessed throws (fail-safe against duplicate writes)", async () => {
      const { isUrlProcessed } = await import("./firestore");
      vi.mocked(isUrlProcessed).mockRejectedValueOnce(
        new Error("Firestore error"),
      );

      const { filterUnprocessed } = await import("./rss-crawler");

      const items = [
        {
          url: "https://example.com/a",
          title: "A",
          date: "2026-06-15T00:00:00.000Z",
        },
      ];

      const result = await filterUnprocessed(items, {} as OboDb, "test-source");
      expect(result).toHaveLength(0);
    });

    it("returns empty array when given empty input", async () => {
      const { filterUnprocessed } = await import("./rss-crawler");

      const result = await filterUnprocessed([], {} as OboDb, "test-source");
      expect(result).toHaveLength(0);
    });
  });
});
