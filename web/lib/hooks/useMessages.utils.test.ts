import { describe, it, expect } from "vitest";
import { buildMessagesUrl } from "./useMessages.utils";

describe("useMessages.utils", () => {
  describe("buildMessagesUrl", () => {
    it("should return base URL when no bounds provided", () => {
      const url = buildMessagesUrl();
      expect(url).toBe("/api/messages");
    });

    it("should return base URL when bounds is null", () => {
      const url = buildMessagesUrl(null);
      expect(url).toBe("/api/messages");
    });

    it("should include bounds as query parameters when provided", () => {
      const bounds = {
        north: 42.7,
        south: 42.65,
        east: 23.4,
        west: 23.3,
      };

      const url = buildMessagesUrl(bounds);

      expect(url).toBe(
        "/api/messages?north=42.7&south=42.65&east=23.4&west=23.3"
      );
    });

    it("should handle decimal coordinates correctly", () => {
      const bounds = {
        north: 42.123456,
        south: 42.654321,
        east: 23.999999,
        west: 23.111111,
      };

      const url = buildMessagesUrl(bounds);

      expect(url).toContain("north=42.123456");
      expect(url).toContain("south=42.654321");
      expect(url).toContain("east=23.999999");
      expect(url).toContain("west=23.111111");
    });

    it("should handle negative coordinates", () => {
      const bounds = {
        north: -10.5,
        south: -20.3,
        east: -5.1,
        west: -15.7,
      };

      const url = buildMessagesUrl(bounds);

      expect(url).toContain("north=-10.5");
      expect(url).toContain("south=-20.3");
      expect(url).toContain("east=-5.1");
      expect(url).toContain("west=-15.7");
    });

    it("should handle zero coordinates", () => {
      const bounds = {
        north: 0,
        south: 0,
        east: 0,
        west: 0,
      };

      const url = buildMessagesUrl(bounds);

      expect(url).toBe("/api/messages?north=0&south=0&east=0&west=0");
    });

    it("should maintain proper URL encoding", () => {
      const bounds = {
        north: 42.7,
        south: 42.65,
        east: 23.4,
        west: 23.3,
      };

      const url = buildMessagesUrl(bounds);

      // Should be a valid URL
      expect(() => new URL(url, "http://localhost")).not.toThrow();
    });

    it("should include all four bounds parameters", () => {
      const bounds = {
        north: 42.7,
        south: 42.65,
        east: 23.4,
        west: 23.3,
      };

      const url = buildMessagesUrl(bounds);

      expect(url).toContain("north=");
      expect(url).toContain("south=");
      expect(url).toContain("east=");
      expect(url).toContain("west=");
    });
  });
});
