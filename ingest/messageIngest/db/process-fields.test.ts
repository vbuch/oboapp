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

    it("should preserve timespanStart and timespanEnd as Date objects", () => {
      const timespanStart = new Date("2026-01-20T08:00:00Z");
      const timespanEnd = new Date("2026-01-20T12:00:00Z");
      const input = {
        timespanStart,
        timespanEnd,
      };

      const result = processFieldsForFirestore(input);

      expect(FieldValue.serverTimestamp).not.toHaveBeenCalled();
      expect(result.timespanStart).toBe(timespanStart);
      expect(result.timespanEnd).toBe(timespanEnd);
    });

    it("should preserve timespanStart/timespanEnd but convert other Date fields", () => {
      const timespanStart = new Date("2026-01-20T08:00:00Z");
      const finalizedAt = new Date("2026-01-23T10:00:00Z");
      const input = {
        timespanStart,
        finalizedAt,
      };

      const result = processFieldsForFirestore(input);

      expect(FieldValue.serverTimestamp).toHaveBeenCalledTimes(1);
      expect(result.timespanStart).toBe(timespanStart);
      expect(result.finalizedAt).toEqual({
        _methodName: "FieldValue.serverTimestamp",
      });
    });
  });

  describe("categories array handling", () => {
    it("should keep categories as native array", () => {
      const input = {
        categories: ["water", "electricity", "heating"],
      };

      const result = processFieldsForFirestore(input);

      expect(result.categories).toEqual(["water", "electricity", "heating"]);
      expect(Array.isArray(result.categories)).toBe(true);
    });

    it("should keep empty categories array", () => {
      const input = {
        categories: [],
      };

      const result = processFieldsForFirestore(input);

      expect(result.categories).toEqual([]);
      expect(Array.isArray(result.categories)).toBe(true);
    });

    it("should coerce JSON string categories to array", () => {
      const input = {
        categories: '["water", "traffic"]',
      };

      const result = processFieldsForFirestore(input);

      expect(result.categories).toEqual(["water", "traffic"]);
      expect(Array.isArray(result.categories)).toBe(true);
    });

    it("should coerce comma-separated categories to array", () => {
      const input = {
        categories: "water, traffic",
      };

      const result = processFieldsForFirestore(input);

      expect(result.categories).toEqual(["water", "traffic"]);
      expect(Array.isArray(result.categories)).toBe(true);
    });

    it("should keep ingestErrors as native array", () => {
      const input = {
        ingestErrors: [
          { text: "⚠️  Partial geocoding", type: "warning" },
          { text: "❌ Failed to extract", type: "error" },
        ],
      };

      const result = processFieldsForFirestore(input);

      expect(result.ingestErrors).toEqual(input.ingestErrors);
      expect(Array.isArray(result.ingestErrors)).toBe(true);
    });
  });

  describe("denormalized fields (native arrays/objects)", () => {
    it("should keep pins as native array", () => {
      const input = {
        pins: [
          {
            address: "ул. Граф Игнатиев 15",
            coordinates: { lat: 42.6977, lng: 23.3219 },
            timespans: [{ start: "20.01.2026 08:00", end: "20.01.2026 18:00" }],
          },
          {
            address: "бул. Витоша 100",
            timespans: [],
          },
        ],
      };

      const result = processFieldsForFirestore(input);

      expect(result.pins).toEqual(input.pins);
      expect(Array.isArray(result.pins)).toBe(true);
      expect(typeof result.pins).not.toBe("string");
    });

    it("should keep streets as native array", () => {
      const input = {
        streets: [
          {
            street: "ул. Граф Игнатиев",
            from: "пл. Света Неделя",
            to: "бул. Евлоги Георгиев",
            coordinates: [
              { lat: 42.6977, lng: 23.3219 },
              { lat: 42.6988, lng: 23.3225 },
            ],
            timespans: [{ start: "21.01.2026 00:00", end: "21.01.2026 23:59" }],
          },
        ],
      };

      const result = processFieldsForFirestore(input);

      expect(result.streets).toEqual(input.streets);
      expect(Array.isArray(result.streets)).toBe(true);
      expect(typeof result.streets).not.toBe("string");
    });

    it("should keep cadastralProperties as native array", () => {
      const input = {
        cadastralProperties: [
          {
            identifier: "68134.502.277",
            timespans: [{ start: "22.01.2026 09:00", end: "22.01.2026 17:00" }],
          },
          {
            identifier: "68134.502.278",
            timespans: [],
          },
        ],
      };

      const result = processFieldsForFirestore(input);

      expect(result.cadastralProperties).toEqual(input.cadastralProperties);
      expect(Array.isArray(result.cadastralProperties)).toBe(true);
      expect(typeof result.cadastralProperties).not.toBe("string");
    });

    it("should keep busStops as native array of strings", () => {
      const input = {
        busStops: ["Площад Македония", "НДК", "Софийски университет"],
      };

      const result = processFieldsForFirestore(input);

      expect(result.busStops).toEqual(input.busStops);
      expect(Array.isArray(result.busStops)).toBe(true);
      expect(typeof result.busStops).not.toBe("string");
    });

    it("should keep empty denormalized arrays", () => {
      const input = {
        pins: [],
        streets: [],
        cadastralProperties: [],
        busStops: [],
      };

      const result = processFieldsForFirestore(input);

      expect(result.pins).toEqual([]);
      expect(result.streets).toEqual([]);
      expect(result.cadastralProperties).toEqual([]);
      expect(result.busStops).toEqual([]);
      expect(Array.isArray(result.pins)).toBe(true);
      expect(Array.isArray(result.streets)).toBe(true);
      expect(Array.isArray(result.cadastralProperties)).toBe(true);
      expect(Array.isArray(result.busStops)).toBe(true);
    });

    it("should keep responsibleEntity as native string", () => {
      const input = {
        responsibleEntity: "Софийска вода АД",
      };

      const result = processFieldsForFirestore(input);

      expect(result.responsibleEntity).toBe("Софийска вода АД");
      expect(typeof result.responsibleEntity).toBe("string");
      // Ensure it's not double-stringified
      expect(result.responsibleEntity).not.toContain('"');
    });

    it("should handle all denormalized fields together", () => {
      const input = {
        responsibleEntity: "Топлофикация София ЕАД",
        pins: [{ address: "Test", timespans: [] }],
        streets: [{ street: "Main St", from: "A", to: "B", timespans: [] }],
        cadastralProperties: [{ identifier: "12345.67.89", timespans: [] }],
        busStops: ["Stop 1", "Stop 2"],
      };

      const result = processFieldsForFirestore(input);

      expect(result.responsibleEntity).toBe(input.responsibleEntity);
      expect(result.pins).toEqual(input.pins);
      expect(result.streets).toEqual(input.streets);
      expect(result.cadastralProperties).toEqual(input.cadastralProperties);
      expect(result.busStops).toEqual(input.busStops);
      // All should be native types, not stringified
      expect(typeof result.responsibleEntity).toBe("string");
      expect(Array.isArray(result.pins)).toBe(true);
      expect(Array.isArray(result.streets)).toBe(true);
      expect(Array.isArray(result.cadastralProperties)).toBe(true);
      expect(Array.isArray(result.busStops)).toBe(true);
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
      expect(JSON.parse(result.extractedData as string)).toEqual(
        input.extractedData,
      );
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
      expect(JSON.parse(result.geoJson as string)).toEqual(input.geoJson);
    });

    it("should stringify categorize object", () => {
      const input = {
        categorize: {
          categories: ["water"],
          isRelevant: true,
        },
      };

      const result = processFieldsForFirestore(input);

      expect(typeof result.categorize).toBe("string");
      expect(JSON.parse(result.categorize as string)).toEqual(input.categorize);
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
      expect(JSON.parse(result.metadata as string)).toEqual(input.metadata);
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

    it("should handle arrays that are not categories (stringify them)", () => {
      const input = {
        addresses: [{ street: "Main St" }],
      };

      const result = processFieldsForFirestore(input);

      expect(typeof result.addresses).toBe("string");
      expect(JSON.parse(result.addresses as string)).toEqual(input.addresses);
    });
  });
});
