import { describe, expect, it } from "vitest";
import { sanitizeText, ensureDate, formatDate } from "./formatters";

describe("sofiyska-voda/formatters", () => {
  describe("sanitizeText", () => {
    it("should remove extra whitespace", () => {
      expect(sanitizeText("  Hello   World  ")).toBe("Hello World");
    });

    it("should handle newlines and tabs", () => {
      expect(sanitizeText("Hello\n\tWorld\t\n  Test")).toBe("Hello World Test");
    });

    it("should return null for empty string", () => {
      expect(sanitizeText("")).toBeNull();
      expect(sanitizeText("   ")).toBeNull();
    });

    it("should return null for null/undefined", () => {
      expect(sanitizeText(null)).toBeNull();
      expect(sanitizeText()).toBeNull();
    });

    it("should preserve single spaces", () => {
      expect(sanitizeText("Normal text here")).toBe("Normal text here");
    });
  });

  describe("ensureDate", () => {
    it("should convert valid timestamp to Date", () => {
      const timestamp = new Date("2025-12-29T10:00:00").getTime();
      const result = ensureDate(timestamp);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2025);
    });

    it("should handle zero timestamp", () => {
      const result = ensureDate(0);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("1970-01-01T00:00:00.000Z");
    });

    it("should return null for null", () => {
      expect(ensureDate(null)).toBeNull();
    });

    it("should return null for undefined", () => {
      expect(ensureDate()).toBeNull();
    });

    it("should return null for invalid timestamp", () => {
      expect(ensureDate(Number.NaN)).toBeNull();
    });
  });

  describe("formatDate", () => {
    it("should format date using default formatter", () => {
      const date = new Date("2025-12-29T14:30:00");
      const result = formatDate(date);
      expect(result).toBeTruthy();
      expect(result).toContain("2025");
      expect(result).toContain("декември");
    });

    it("should format date using custom formatter", () => {
      const date = new Date("2025-12-29T14:30:00");
      const customFormatter = new Intl.DateTimeFormat("en-US", {
        dateStyle: "short",
      });
      const result = formatDate(date, customFormatter);
      expect(result).toContain("12/29/25");
    });

    it("should return null for null date", () => {
      expect(formatDate(null)).toBeNull();
    });

    it("should return null for undefined date", () => {
      expect(formatDate()).toBeNull();
    });
  });
});
