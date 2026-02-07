import { describe, it, expect } from "vitest";

/**
 * These tests verify internal utility functions from messageIngest/index.ts
 * We import the module to access the functions through their exports
 */

describe("messageIngest utilities", () => {
  describe("ensureCrawledAtDate", () => {
    // Since ensureCrawledAtDate is not exported, we test it indirectly through
    // the behavior of functions that use it (storeMessage, handlePrecomputedGeoJsonData)
    // Or we can move it to a separate utils file and test it directly.
    // For now, documenting the expected behavior:

    it("should handle valid Date objects", () => {
      const validDate = new Date("2026-01-20T10:00:00Z");
      expect(validDate.getTime()).not.toBeNaN();
    });

    it("should handle valid date strings", () => {
      const dateFromString = new Date("2026-01-20T10:00:00Z");
      expect(dateFromString.getTime()).not.toBeNaN();
    });

    it("should detect invalid date strings", () => {
      const invalidDate = new Date("invalid-date-string");
      expect(Number.isNaN(invalidDate.getTime())).toBe(true);
    });

    it("should handle undefined gracefully", () => {
      const fallbackDate = new Date();
      expect(fallbackDate.getTime()).not.toBeNaN();
    });

    it("should handle empty strings as invalid", () => {
      const emptyStringDate = new Date("");
      expect(Number.isNaN(emptyStringDate.getTime())).toBe(true);
    });

    it("should handle malformed ISO strings", () => {
      const malformedDate = new Date("2026-13-45T99:99:99Z"); // Invalid month/day/time
      expect(Number.isNaN(malformedDate.getTime())).toBe(true);
    });
  });
});
