import { describe, expect, it } from "vitest";
import {
  computeCategoryCounts,
  computeHasActiveFilters,
  computeSelectedCategories,
  toggleCategorySelection,
} from "./useCategoryFilter";
import { Category, UNCATEGORIZED } from "@oboapp/shared";
import { Message } from "@/lib/types";

const buildFeatureCollection = (count: number) => ({
  type: "FeatureCollection" as const,
  features: Array.from({ length: count }, (_, index) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [0, 0] as [number, number],
    },
    properties: { index },
  })),
});

const buildMessage = (overrides: Partial<Message>): Message => ({
  text: "Test message",
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("useCategoryFilter helpers", () => {
  describe("computeSelectedCategories", () => {
    it("returns available categories minus unselected", () => {
      const available = new Set<Category | typeof UNCATEGORIZED>([
        "water",
        "traffic",
        UNCATEGORIZED,
      ]);
      const unselected = new Set<Category | typeof UNCATEGORIZED>(["traffic"]);

      const selected = computeSelectedCategories(available, unselected);

      expect(Array.from(selected).sort()).toEqual(
        ["water", UNCATEGORIZED].sort(),
      );
    });
  });

  describe("computeCategoryCounts", () => {
    it("counts features per category and orders output", () => {
      const available = new Set<Category | typeof UNCATEGORIZED>([
        "water",
        "traffic",
        UNCATEGORIZED,
      ]);
      const viewportMessages: Message[] = [
        buildMessage({
          categories: ["water"],
          geoJson: buildFeatureCollection(2),
        }),
        buildMessage({
          categories: ["traffic", "water"],
          geoJson: buildFeatureCollection(1),
        }),
        buildMessage({
          geoJson: buildFeatureCollection(3),
        }),
      ];

      const counts = computeCategoryCounts(available, viewportMessages);

      expect(counts).toEqual([
        { category: "water", count: 3 },
        { category: "traffic", count: 1 },
        { category: UNCATEGORIZED, count: 3 },
      ]);
    });
  });

  describe("computeHasActiveFilters", () => {
    it("returns false when all available categories are selected", () => {
      const available = new Set<Category | typeof UNCATEGORIZED>([
        "water",
        "traffic",
        UNCATEGORIZED,
      ]);
      const selected = new Set<Category | typeof UNCATEGORIZED>([
        "water",
        "traffic",
        UNCATEGORIZED,
      ]);

      expect(computeHasActiveFilters(selected, available)).toBe(false);
    });

    it("returns true when at least one category is unselected", () => {
      const available = new Set<Category | typeof UNCATEGORIZED>([
        "water",
        "traffic",
        UNCATEGORIZED,
      ]);
      const selected = new Set<Category | typeof UNCATEGORIZED>([
        "water",
        UNCATEGORIZED,
      ]);

      expect(computeHasActiveFilters(selected, available)).toBe(true);
    });
  });

  describe("toggleCategorySelection", () => {
    it("removes a category when already selected", () => {
      const current = new Set<Category | typeof UNCATEGORIZED>([
        "water",
        "traffic",
      ]);

      const next = toggleCategorySelection(current, "traffic");

      expect(Array.from(next).sort()).toEqual(["water"].sort());
      expect(Array.from(current).sort()).toEqual(["traffic", "water"].sort());
    });

    it("adds a category when not selected", () => {
      const current = new Set<Category | typeof UNCATEGORIZED>(["water"]);

      const next = toggleCategorySelection(current, UNCATEGORIZED);

      expect(Array.from(next).sort()).toEqual(["water", UNCATEGORIZED].sort());
    });
  });
});
