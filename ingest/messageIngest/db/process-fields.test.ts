import { describe, it, expect, vi, beforeEach } from "vitest";
import { FieldValue } from "firebase-admin/firestore";
import { processFieldsForFirestore } from "./process-fields";

// Mock FieldValue.serverTimestamp()
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => ({
      _methodName: "FieldValue.serverTimestamp",
    })),
  },
}));

describe("processFieldsForFirestore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Date handling", () => {
    it("should convert Date objects to serverTimestamp", () => {
      const input = {
        createdAt: new Date("2026-01-18T10:00:00Z"),
        updatedAt: new Date("2026-01-18T11:00:00Z"),
      };

      const result = processFieldsForFirestore(input);

      expect(FieldValue.serverTimestamp).toHaveBeenCalledTimes(2);
      expect(result.createdAt).toEqual({
        _methodName: "FieldValue.serverTimestamp",
      });
      expect(result.updatedAt).toEqual({
        _methodName: "FieldValue.serverTimestamp",
      });
    });
  });

  describe("categories and relations array handling", () => {
    it("should keep categories as native array", () => {
      const input = {
        categories: ["water", "electricity", "heating"],
      };

      const result = processFieldsForFirestore(input);

      expect(result.categories).toEqual(["water", "electricity", "heating"]);
      expect(Array.isArray(result.categories)).toBe(true);
    });

    it("should keep relations as native array", () => {
      const input = {
        relations: ["rel1", "rel2"],
      };

      const result = processFieldsForFirestore(input);

      expect(result.relations).toEqual(["rel1", "rel2"]);
      expect(Array.isArray(result.relations)).toBe(true);
    });

    it("should keep empty categories array", () => {
      const input = {
        categories: [],
      };

      const result = processFieldsForFirestore(input);

      expect(result.categories).toEqual([]);
      expect(Array.isArray(result.categories)).toBe(true);
    });
  });

  describe("object stringification", () => {
    it("should stringify extractedData object", () => {
      const input = {
        extractedData: {
          responsible_entity: "Sofia Water",
          pins: [{ address: "Test St", timespans: [] }],
        },
      };

      const result = processFieldsForFirestore(input);

      expect(typeof result.extractedData).toBe("string");
      expect(JSON.parse(result.extractedData)).toEqual(input.extractedData);
    });

    it("should stringify geoJson object", () => {
      const input = {
        geoJson: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [23.3, 42.7] },
              properties: {},
            },
          ],
        },
      };

      const result = processFieldsForFirestore(input);

      expect(typeof result.geoJson).toBe("string");
      expect(JSON.parse(result.geoJson)).toEqual(input.geoJson);
    });

    it("should stringify categorize object", () => {
      const input = {
        categorize: {
          categories: ["water"],
          relations: [],
          isRelevant: true,
        },
      };

      const result = processFieldsForFirestore(input);

      expect(typeof result.categorize).toBe("string");
      expect(JSON.parse(result.categorize)).toEqual(input.categorize);
    });

    it("should stringify nested objects", () => {
      const input = {
        metadata: {
          nested: {
            deeply: {
              value: 42,
            },
          },
        },
      };

      const result = processFieldsForFirestore(input);

      expect(typeof result.metadata).toBe("string");
      expect(JSON.parse(result.metadata)).toEqual(input.metadata);
    });

    it("should not stringify null values", () => {
      const input = {
        nullField: null,
      };

      const result = processFieldsForFirestore(input);

      expect(result.nullField).toBeNull();
    });
  });

  describe("primitive handling", () => {
    it("should pass through strings unchanged", () => {
      const input = {
        text: "Some message text",
        source: "rayon-oborishte-bg",
      };

      const result = processFieldsForFirestore(input);

      expect(result.text).toBe("Some message text");
      expect(result.source).toBe("rayon-oborishte-bg");
    });

    it("should pass through numbers unchanged", () => {
      const input = {
        count: 42,
        rating: 3.14,
      };

      const result = processFieldsForFirestore(input);

      expect(result.count).toBe(42);
      expect(result.rating).toBe(3.14);
    });

    it("should pass through booleans unchanged", () => {
      const input = {
        isActive: true,
        isDeleted: false,
      };

      const result = processFieldsForFirestore(input);

      expect(result.isActive).toBe(true);
      expect(result.isDeleted).toBe(false);
    });

    it("should pass through undefined unchanged", () => {
      const input = {
        optionalField: undefined,
      };

      const result = processFieldsForFirestore(input);

      expect(result.optionalField).toBeUndefined();
    });
  });

  describe("mixed field types", () => {
    it("should handle all field types correctly in one object", () => {
      const input = {
        // Primitives
        text: "Message",
        count: 5,
        isActive: true,
        // Date
        createdAt: new Date("2026-01-18"),
        // Arrays (special handling)
        categories: ["water", "electricity"],
        relations: ["rel1"],
        // Objects (stringified)
        extractedData: { pins: [], streets: [] },
        geoJson: { type: "FeatureCollection", features: [] },
        // Null
        deletedAt: null,
      };

      const result = processFieldsForFirestore(input);

      expect(result.text).toBe("Message");
      expect(result.count).toBe(5);
      expect(result.isActive).toBe(true);
      expect(result.createdAt).toEqual({
        _methodName: "FieldValue.serverTimestamp",
      });
      expect(result.categories).toEqual(["water", "electricity"]);
      expect(result.relations).toEqual(["rel1"]);
      expect(typeof result.extractedData).toBe("string");
      expect(typeof result.geoJson).toBe("string");
      expect(result.deletedAt).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should handle empty object", () => {
      const result = processFieldsForFirestore({});
      expect(result).toEqual({});
    });

    it("should handle arrays that are not categories or relations (stringify them)", () => {
      const input = {
        addresses: [{ street: "Main St" }],
      };

      const result = processFieldsForFirestore(input);

      expect(typeof result.addresses).toBe("string");
      expect(JSON.parse(result.addresses)).toEqual(input.addresses);
    });
  });
});
