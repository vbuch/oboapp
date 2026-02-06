import { describe, it, expect } from "vitest";
import { generateSlug, isValidSlug } from "./slug-utils";

describe("slug-utils", () => {
  describe("generateSlug", () => {
    it("should generate a slug of length 8", () => {
      const slug = generateSlug();
      expect(slug).toHaveLength(8);
    });

    it("should generate alphanumeric slugs", () => {
      const slug = generateSlug();
      expect(slug).toMatch(/^[0-9A-Za-z]+$/);
    });

    it("should generate different slugs on each call", () => {
      const slugs = new Set();
      for (let i = 0; i < 100; i++) {
        slugs.add(generateSlug());
      }
      // Should have 100 unique slugs
      expect(slugs.size).toBe(100);
    });

    it("should only use valid characters", () => {
      const validChars = new Set(
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
      );
      const slug = generateSlug();
      for (const char of slug) {
        expect(validChars.has(char)).toBe(true);
      }
    });
  });

  describe("isValidSlug", () => {
    it("should validate correct slugs", () => {
      expect(isValidSlug("aB3xYz12")).toBe(true);
      expect(isValidSlug("12345678")).toBe(true);
      expect(isValidSlug("ABCDefgh")).toBe(true);
    });

    it("should reject slugs of incorrect length", () => {
      expect(isValidSlug("abc")).toBe(false);
      expect(isValidSlug("abcdefghi")).toBe(false);
      expect(isValidSlug("")).toBe(false);
    });

    it("should reject slugs with invalid characters", () => {
      expect(isValidSlug("aB3xYz-1")).toBe(false);
      expect(isValidSlug("aB3xYz_1")).toBe(false);
      expect(isValidSlug("aB3xYz 1")).toBe(false);
      expect(isValidSlug("aB3хYz12")).toBe(false); // Cyrillic
    });

    it("should reject null/undefined", () => {
      expect(isValidSlug(null as unknown as string)).toBe(false);
      expect(isValidSlug(undefined as unknown as string)).toBe(false);
    });
  });
});
