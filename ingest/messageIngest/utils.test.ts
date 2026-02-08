import { describe, it, expect } from "vitest";
import {
  formatMessageLogInfo,
  createIngestionStatistics,
  isValidMessageIndex,
  getMessageDisplayName,
} from "./utils";

describe("messageIngest utils", () => {
  describe("formatMessageLogInfo", () => {
    it("should format log info for relevant message", () => {
      const categorizedMessage = {
        categories: ["traffic", "infrastructure"],
        isRelevant: true,
      };

      const result = formatMessageLogInfo(
        categorizedMessage,
        2,
        5,
        "aB3xYz12",
      );

      expect(result).toEqual([
        "\n📄 Processing message 2/5",
        "   Categories: traffic, infrastructure",
        "   Relevant: true",
        "   Message ID: aB3xYz12",
      ]);
    });

    it("should format log info for irrelevant message", () => {
      const categorizedMessage = {
        categories: ["spam"],
        isRelevant: false,
      };

      const result = formatMessageLogInfo(
        categorizedMessage,
        1,
        1,
        undefined,
      );

      expect(result).toEqual([
        "\n📄 Processing message 1/1",
        "   Categories: spam",
        "   Relevant: false",
        "   Message ID: auto-generated",
      ]);
    });

    it("should handle empty categories", () => {
      const categorizedMessage = {
        categories: [],
        isRelevant: true,
      };

      const result = formatMessageLogInfo(
        categorizedMessage,
        1,
        2,
        "cD4eWq56",
      );

      expect(result[1]).toBe("   Categories: ");
    });

    it("should handle single category", () => {
      const categorizedMessage = {
        categories: ["water"],
        isRelevant: true,
      };

      const result = formatMessageLogInfo(
        categorizedMessage,
        1,
        1,
        "eFg7HiJ8",
      );

      expect(result[1]).toBe("   Categories: water");
    });
  });

  describe("createIngestionStatistics", () => {
    it("should create statistics with all relevant messages", () => {
      const result = createIngestionStatistics(5, 5, 0);

      expect(result).toEqual({
        totalCategorized: 5,
        totalRelevant: 5,
        totalIrrelevant: 0,
        relevantPercentage: 100,
      });
    });

    it("should create statistics with mixed relevance", () => {
      const result = createIngestionStatistics(10, 7, 3);

      expect(result).toEqual({
        totalCategorized: 10,
        totalRelevant: 7,
        totalIrrelevant: 3,
        relevantPercentage: 70,
      });
    });

    it("should handle zero messages", () => {
      const result = createIngestionStatistics(0, 0, 0);

      expect(result).toEqual({
        totalCategorized: 0,
        totalRelevant: 0,
        totalIrrelevant: 0,
        relevantPercentage: 0,
      });
    });

    it("should handle all irrelevant messages", () => {
      const result = createIngestionStatistics(3, 0, 3);

      expect(result).toEqual({
        totalCategorized: 3,
        totalRelevant: 0,
        totalIrrelevant: 3,
        relevantPercentage: 0,
      });
    });

    it("should calculate percentage correctly with decimals", () => {
      const result = createIngestionStatistics(3, 2, 1);

      expect(result.relevantPercentage).toBeCloseTo(66.67, 2);
    });
  });

  describe("isValidMessageIndex", () => {
    it("should return true for valid indices", () => {
      expect(isValidMessageIndex(1, 5)).toBe(true);
      expect(isValidMessageIndex(3, 5)).toBe(true);
      expect(isValidMessageIndex(5, 5)).toBe(true);
    });

    it("should return false for index too low", () => {
      expect(isValidMessageIndex(0, 5)).toBe(false);
      expect(isValidMessageIndex(-1, 5)).toBe(false);
    });

    it("should return false for index too high", () => {
      expect(isValidMessageIndex(6, 5)).toBe(false);
      expect(isValidMessageIndex(100, 5)).toBe(false);
    });

    it("should return false for invalid total messages", () => {
      expect(isValidMessageIndex(1, 0)).toBe(false);
      expect(isValidMessageIndex(1, -1)).toBe(false);
    });

    it("should handle edge case with single message", () => {
      expect(isValidMessageIndex(1, 1)).toBe(true);
      expect(isValidMessageIndex(2, 1)).toBe(false);
    });
  });

  describe("getMessageDisplayName", () => {
    it("should return the message ID when provided", () => {
      expect(getMessageDisplayName("msg123")).toBe("msg123");
      expect(getMessageDisplayName("doc456-1")).toBe("doc456-1");
    });

    it("should return 'auto-generated' when ID is undefined", () => {
      expect(getMessageDisplayName(undefined)).toBe("auto-generated");
    });

    it("should return 'auto-generated' for empty string ID", () => {
      expect(getMessageDisplayName("")).toBe("auto-generated");
    });
  });
});
