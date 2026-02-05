import { describe, it, expect } from "vitest";
import {
  CategorizationResponseSchema,
  type CategorizationResult,
  type Category,
} from "./categorize.schema";
import { CategoryEnum } from "@oboapp/shared";

describe("CategorizationResponseSchema", () => {
  describe("valid schemas", () => {
    it("should validate complete valid categorization result", () => {
      const validData: CategorizationResult = [
        {
          categories: ["water", "construction-and-repairs"],
          relations: ["метро", "строителство"],
          withSpecificAddress: true,
          specificAddresses: ["бул. Витоша 1", "ул. Граф Игнатиев 125"],
          coordinates: ["42.6977, 23.3219", "42.7000, 23.3250"],
          busStops: ["0001", "0234"],
          cadastralProperties: ["68134.501.123", "68134.502.456"],
          cityWide: false,
          isRelevant: true,
          normalizedText:
            "Спиране на водоснабдяването поради строителство на метро.",
        },
      ];

      const result = CategorizationResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it("should validate minimal valid categorization result", () => {
      const validData: CategorizationResult = [
        {
          categories: [],
          withSpecificAddress: false,
          specificAddresses: [],
          coordinates: [],
          busStops: [],
          cadastralProperties: [],
          cityWide: false,
          isRelevant: false,
          normalizedText: "",
        },
      ];

      const result = CategorizationResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should coerce JSON array string categories", () => {
      const validData = [
        {
          categories: '["water", "traffic"]',
          withSpecificAddress: false,
          specificAddresses: [],
          coordinates: [],
          busStops: [],
          cadastralProperties: [],
          cityWide: false,
          isRelevant: true,
          normalizedText: "Test message.",
        },
      ];

      const result = CategorizationResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].categories).toEqual(["water", "traffic"]);
      }
    });

    it("should coerce comma-separated categories", () => {
      const validData = [
        {
          categories: "water, traffic",
          withSpecificAddress: false,
          specificAddresses: [],
          coordinates: [],
          busStops: [],
          cadastralProperties: [],
          cityWide: false,
          isRelevant: true,
          normalizedText: "Test message.",
        },
      ];

      const result = CategorizationResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].categories).toEqual(["water", "traffic"]);
      }
    });

    it("should coerce whitespace-only categories to empty array", () => {
      const validData = [
        {
          categories: "   ",
          withSpecificAddress: false,
          specificAddresses: [],
          coordinates: [],
          busStops: [],
          cadastralProperties: [],
          cityWide: false,
          isRelevant: false,
          normalizedText: "",
        },
      ];

      const result = CategorizationResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].categories).toEqual([]);
      }
    });

    it("should validate multiple categorized messages", () => {
      const validData: CategorizationResult = [
        {
          categories: ["water"],
          withSpecificAddress: true,
          specificAddresses: ["бул. Витоша 1"],
          coordinates: [],
          busStops: [],
          cadastralProperties: [],
          cityWide: false,
          isRelevant: true,
          normalizedText: "Спиране на водоснабдяването.",
        },
        {
          categories: ["heating", "construction-and-repairs"],
          relations: ["зимна поддръжка"],
          withSpecificAddress: false,
          specificAddresses: [],
          coordinates: [],
          busStops: [],
          cadastralProperties: [],
          cityWide: true,
          isRelevant: true,
          normalizedText: "Планова поддръжка на отоплението в целия град.",
        },
      ];

      const result = CategorizationResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should validate all valid category enum values", () => {
      const allCategories: Category[] = [
        "air-quality",
        "art",
        "bicycles",
        "construction-and-repairs",
        "culture",
        "electricity",
        "health",
        "heating",
        "parking",
        "public-transport",
        "road-block",
        "sports",
        "traffic",
        "vehicles",
        "waste",
        "water",
        "weather",
      ];

      const validData: CategorizationResult = [
        {
          categories: allCategories,
          withSpecificAddress: false,
          specificAddresses: [],
          coordinates: [],
          busStops: [],
          cadastralProperties: [],
          cityWide: false,
          isRelevant: true,
          normalizedText: "Test message with all categories.",
        },
      ];

      const result = CategorizationResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should default omitted address fields to empty arrays", () => {
      // This simulates AI output when withSpecificAddress is false
      const dataWithOmittedFields = [
        {
          categories: ["water"],
          withSpecificAddress: false,
          cityWide: false,
          isRelevant: true,
          normalizedText: "General water maintenance.",
        },
      ];

      const result = CategorizationResponseSchema.safeParse(
        dataWithOmittedFields,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].specificAddresses).toEqual([]);
        expect(result.data[0].coordinates).toEqual([]);
        expect(result.data[0].busStops).toEqual([]);
        expect(result.data[0].cadastralProperties).toEqual([]);
      }
    });

    it("should validate various coordinate formats", () => {
      const validCoordinates = [
        "42.6977, 23.3219",
        "42.7000, 23.3250",
        "-42.6977, -23.3219",
        "0.0, 0.0",
        "42.6977,23.3219", // no space after comma
        "42.6977,  23.3219", // multiple spaces after comma
      ];

      const validData: CategorizationResult = [
        {
          categories: ["water"],
          withSpecificAddress: true,
          specificAddresses: [],
          coordinates: validCoordinates,
          busStops: [],
          cadastralProperties: [],
          cityWide: false,
          isRelevant: true,
          normalizedText: "Test coordinates.",
        },
      ];

      const result = CategorizationResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe("invalid schemas", () => {
    it("should reject invalid category enum values", () => {
      const invalidData = [
        {
          categories: ["invalid-category", "water"], // invalid category
          withSpecificAddress: false,
          specificAddresses: [],
          coordinates: [],
          busStops: [],
          cadastralProperties: [],
          cityWide: false,
          isRelevant: true,
          normalizedText: "Test message.",
        },
      ];

      const result = CategorizationResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject invalid coordinate formats", () => {
      const invalidCoordinates = [
        "invalid-coordinate",
        "42.6977",
        "42.6977,",
        ",23.3219",
        "42,23", // missing decimal places
        "42.6977 23.3219", // space instead of comma
        "42.6977; 23.3219", // semicolon instead of comma
      ];

      for (const invalidCoordinate of invalidCoordinates) {
        const invalidData = [
          {
            categories: ["water"],
            withSpecificAddress: true,
            specificAddresses: [],
            coordinates: [invalidCoordinate],
            busStops: [],
            cadastralProperties: [],
            cityWide: false,
            isRelevant: true,
            normalizedText: "Test message.",
          },
        ];

        const result = CategorizationResponseSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      }
    });

    it("should reject missing required fields", () => {
      const invalidData = [
        {
          categories: ["water"],
          // missing required fields
        },
      ];

      const result = CategorizationResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject wrong types for fields", () => {
      const invalidData = [
        {
          categories: [123], // invalid category type
          withSpecificAddress: "true", // should be boolean
          specificAddresses: "address", // should be array
          coordinates: [],
          busStops: [],
          cadastralProperties: [],
          cityWide: false,
          isRelevant: true,
          normalizedText: "Test message.",
        },
      ];

      const result = CategorizationResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject non-array root structure", () => {
      const invalidData = {
        categories: ["water"],
        withSpecificAddress: false,
        specificAddresses: [],
        coordinates: [],
        busStops: [],
        cadastralProperties: [],
        cityWide: false,
        isRelevant: true,
        normalizedText: "Test message.",
      };

      const result = CategorizationResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject null or undefined input", () => {
      expect(CategorizationResponseSchema.safeParse(null).success).toBe(false);
      expect(CategorizationResponseSchema.safeParse(undefined).success).toBe(
        false,
      );
    });
  });

  describe("CategoryEnum", () => {
    it("should contain all expected category values", () => {
      const expectedCategories = [
        "air-quality",
        "art",
        "bicycles",
        "construction-and-repairs",
        "culture",
        "electricity",
        "health",
        "heating",
        "parking",
        "public-transport",
        "road-block",
        "sports",
        "traffic",
        "vehicles",
        "waste",
        "water",
        "weather",
      ];

      expect(CategoryEnum.options).toEqual(expectedCategories);
    });

    it("should validate individual category values", () => {
      expect(CategoryEnum.safeParse("water").success).toBe(true);
      expect(CategoryEnum.safeParse("invalid-category").success).toBe(false);
    });
  });
});
