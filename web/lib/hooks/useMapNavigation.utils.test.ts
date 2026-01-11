import { describe, it, expect } from "vitest";
import { parseMapCenterFromParams } from "./useMapNavigation.utils";

describe("useMapNavigation.utils", () => {
  describe("parseMapCenterFromParams", () => {
    it("should return null when lat is null", () => {
      const result = parseMapCenterFromParams(null, "23.3");
      expect(result).toBeNull();
    });

    it("should return null when lng is null", () => {
      const result = parseMapCenterFromParams("42.7", null);
      expect(result).toBeNull();
    });

    it("should return null when both lat and lng are null", () => {
      const result = parseMapCenterFromParams(null, null);
      expect(result).toBeNull();
    });

    it("should return null when lat is not a valid number", () => {
      const result = parseMapCenterFromParams("not-a-number", "23.3");
      expect(result).toBeNull();
    });

    it("should return null when lng is not a valid number", () => {
      const result = parseMapCenterFromParams("42.7", "not-a-number");
      expect(result).toBeNull();
    });

    it("should return null when both lat and lng are not valid numbers", () => {
      const result = parseMapCenterFromParams("invalid", "invalid");
      expect(result).toBeNull();
    });

    it("should parse valid lat and lng strings", () => {
      const result = parseMapCenterFromParams("42.7", "23.3");
      expect(result).toEqual({ lat: 42.7, lng: 23.3 });
    });

    it("should parse decimal coordinates correctly", () => {
      const result = parseMapCenterFromParams("42.123456", "23.654321");
      expect(result).toEqual({ lat: 42.123456, lng: 23.654321 });
    });

    it("should handle negative coordinates", () => {
      const result = parseMapCenterFromParams("-42.7", "-23.3");
      expect(result).toEqual({ lat: -42.7, lng: -23.3 });
    });

    it("should handle zero coordinates", () => {
      const result = parseMapCenterFromParams("0", "0");
      expect(result).toEqual({ lat: 0, lng: 0 });
    });

    it("should handle coordinates with leading/trailing spaces", () => {
      const result = parseMapCenterFromParams("  42.7  ", "  23.3  ");
      expect(result).toEqual({ lat: 42.7, lng: 23.3 });
    });

    it("should handle scientific notation", () => {
      const result = parseMapCenterFromParams("4.27e1", "2.33e1");
      expect(result).toEqual({ lat: 42.7, lng: 23.3 });
    });

    it("should handle integer strings", () => {
      const result = parseMapCenterFromParams("42", "23");
      expect(result).toEqual({ lat: 42, lng: 23 });
    });

    it("should return null for empty strings", () => {
      const result = parseMapCenterFromParams("", "");
      expect(result).toBeNull();
    });

    it("should return null when lat is empty string", () => {
      const result = parseMapCenterFromParams("", "23.3");
      expect(result).toBeNull();
    });

    it("should return null when lng is empty string", () => {
      const result = parseMapCenterFromParams("42.7", "");
      expect(result).toBeNull();
    });

    it("should handle very large numbers", () => {
      const result = parseMapCenterFromParams("999999.999", "888888.888");
      expect(result).toEqual({ lat: 999999.999, lng: 888888.888 });
    });

    it("should handle very small numbers", () => {
      const result = parseMapCenterFromParams("0.000001", "0.000002");
      expect(result).toEqual({ lat: 0.000001, lng: 0.000002 });
    });

    it("should return null for special values like Infinity", () => {
      const result = parseMapCenterFromParams("Infinity", "23.3");
      expect(result).toBeNull();
    });

    it("should return null for NaN string", () => {
      const result = parseMapCenterFromParams("NaN", "23.3");
      expect(result).toBeNull();
    });
  });
});
