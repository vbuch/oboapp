import { describe, expect, it } from "vitest";
import {
  getCategoryIcon,
  getCategoryColor,
  getCategoryBgColor,
  CATEGORY_STYLES,
} from "@/lib/category-styles";
import { CATEGORIES, UNCATEGORIZED } from "@oboapp/shared";

describe("category-styles", () => {
  describe("CATEGORY_STYLES", () => {
    it("has styles for all categories", () => {
      CATEGORIES.forEach((category) => {
        expect(CATEGORY_STYLES[category]).toBeDefined();
        expect(CATEGORY_STYLES[category].icon).toBeDefined();
        expect(CATEGORY_STYLES[category].color).toBeDefined();
        expect(CATEGORY_STYLES[category].bgColor).toBeDefined();
      });
    });

    it("has styles for uncategorized", () => {
      expect(CATEGORY_STYLES[UNCATEGORIZED]).toBeDefined();
      expect(CATEGORY_STYLES[UNCATEGORIZED].icon).toBeDefined();
      expect(CATEGORY_STYLES[UNCATEGORIZED].color).toBeDefined();
      expect(CATEGORY_STYLES[UNCATEGORIZED].bgColor).toBeDefined();
    });

    it("all colors are valid hex codes", () => {
      const hexRegex = /^#[0-9a-f]{6}$/i;
      Object.values(CATEGORY_STYLES).forEach((style) => {
        expect(style.color).toMatch(hexRegex);
        expect(style.bgColor).toMatch(hexRegex);
      });
    });
  });

  describe("getCategoryIcon", () => {
    it("returns icon for valid category", () => {
      const icon = getCategoryIcon("water");
      expect(icon).toBeDefined();
      expect(typeof icon).toBe("object");
    });

    it("returns icon for uncategorized", () => {
      const icon = getCategoryIcon(UNCATEGORIZED);
      expect(icon).toBeDefined();
      expect(typeof icon).toBe("object");
    });
  });

  describe("getCategoryColor", () => {
    it("returns color for valid category", () => {
      const color = getCategoryColor("water");
      expect(color).toBe("#0284c7");
    });

    it("returns color for uncategorized", () => {
      const color = getCategoryColor(UNCATEGORIZED);
      expect(color).toBe("#6b7280");
    });

    it("returns default color for invalid category", () => {
      // @ts-expect-error - testing invalid input
      const color = getCategoryColor("invalid-category");
      expect(color).toBe("#6b7280");
    });
  });

  describe("getCategoryBgColor", () => {
    it("returns background color for valid category", () => {
      const bgColor = getCategoryBgColor("water");
      expect(bgColor).toBe("#e0f2fe");
    });

    it("returns background color for uncategorized", () => {
      const bgColor = getCategoryBgColor(UNCATEGORIZED);
      expect(bgColor).toBe("#f3f4f6");
    });

    it("returns default background color for invalid category", () => {
      // @ts-expect-error - testing invalid input
      const bgColor = getCategoryBgColor("invalid-category");
      expect(bgColor).toBe("#f3f4f6");
    });
  });
});
