import { describe, it, expect } from "vitest";
import {
  validatePins,
  validateStreets,
  validateCadastralProperties,
  parseCategorizationResponse,
  parseExtractionResponse,
} from "./ai-response-parser";

describe("ai-response-parser", () => {
  describe("validatePins", () => {
    it("should validate valid pins", () => {
      const pins = [
        {
          address: "бул. Витоша 1",
          timespans: [
            { start: "2024-01-01T10:00:00Z", end: "2024-01-01T12:00:00Z" },
          ],
        },
      ];
      const result = validatePins(pins);
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe("бул. Витоша 1");
      expect(result[0].timespans).toHaveLength(1);
    });

    it("should filter out pins without addresses", () => {
      const pins = [
        {
          timespans: [
            { start: "2024-01-01T10:00:00Z", end: "2024-01-01T12:00:00Z" },
          ],
        },
      ];
      const result = validatePins(pins);
      expect(result).toHaveLength(0);
    });

    it("should filter out pins with empty addresses", () => {
      const pins = [
        {
          address: "   ",
          timespans: [
            { start: "2024-01-01T10:00:00Z", end: "2024-01-01T12:00:00Z" },
          ],
        },
      ];
      const result = validatePins(pins);
      expect(result).toHaveLength(0);
    });

    it("should filter out pins without timespans", () => {
      const pins = [{ address: "бул. Витоша 1" }];
      const result = validatePins(pins);
      expect(result).toHaveLength(0);
    });

    it("should filter out invalid timespans", () => {
      const pins = [
        {
          address: "бул. Витоша 1",
          timespans: [
            { start: "2024-01-01T10:00:00Z", end: "2024-01-01T12:00:00Z" },
            { start: "invalid" }, // Missing end
            { end: "2024-01-01T14:00:00Z" }, // Missing start
          ],
        },
      ];
      const result = validatePins(pins);
      expect(result).toHaveLength(1);
      expect(result[0].timespans).toHaveLength(1);
    });

    it("should return empty array for non-array input", () => {
      const result = validatePins("not an array");
      expect(result).toEqual([]);
    });

    it("should return empty array for null input", () => {
      const result = validatePins(null);
      expect(result).toEqual([]);
    });
  });

  describe("validateStreets", () => {
    it("should validate valid streets", () => {
      const streets = [
        {
          street: "бул. Витоша",
          from: "ул. Алабин",
          to: "пл. България",
          timespans: [
            { start: "2024-01-01T10:00:00Z", end: "2024-01-01T12:00:00Z" },
          ],
        },
      ];
      const result = validateStreets(streets);
      expect(result).toHaveLength(1);
      expect(result[0].street).toBe("бул. Витоша");
      expect(result[0].from).toBe("ул. Алабин");
      expect(result[0].to).toBe("пл. България");
    });

    it("should filter out streets without required fields", () => {
      const streets = [
        { street: "бул. Витоша", timespans: [] }, // Missing from/to
        { from: "ул. Алабин", to: "пл. България", timespans: [] }, // Missing street
      ];
      const result = validateStreets(streets);
      expect(result).toHaveLength(0);
    });

    it("should return empty array for non-array input", () => {
      const result = validateStreets({});
      expect(result).toEqual([]);
    });
  });

  describe("validateCadastralProperties", () => {
    it("should validate valid cadastral properties", () => {
      const properties = [
        {
          identifier: "68134.501.123",
          timespans: [
            { start: "2024-01-01T10:00:00Z", end: "2024-01-01T12:00:00Z" },
          ],
        },
      ];
      const result = validateCadastralProperties(properties);
      expect(result).toHaveLength(1);
      expect(result[0].identifier).toBe("68134.501.123");
    });

    it("should filter out properties with empty identifiers", () => {
      const properties = [
        {
          identifier: "  ",
          timespans: [
            { start: "2024-01-01T10:00:00Z", end: "2024-01-01T12:00:00Z" },
          ],
        },
      ];
      const result = validateCadastralProperties(properties);
      expect(result).toHaveLength(0);
    });

    it("should return empty array for non-array input", () => {
      const result = validateCadastralProperties(undefined);
      expect(result).toEqual([]);
    });
  });

  describe("parseCategorizationResponse", () => {
    it("should parse valid categorization response", () => {
      const response = JSON.stringify([
        {
          categories: ["water"],
          withSpecificAddress: false,
          specificAddresses: [],
          coordinates: [],
          busStops: [],
          cadastralProperties: [],
          cityWide: false,
          isRelevant: true,
          normalizedText: "Test message",
        },
      ]);
      const result = parseCategorizationResponse(response);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0].categories).toContain("water");
    });

    it("should return null for invalid JSON", () => {
      const errors: string[] = [];
      const mockRecorder = {
        error: (msg: string) => errors.push(msg),
        warn: () => {},
        exception: () => {},
      };
      const result = parseCategorizationResponse(
        "not valid json",
        mockRecorder,
      );
      expect(result).toBeNull();
      expect(errors.length).toBeGreaterThan(0);
    });

    it("should return null for invalid schema", () => {
      const errors: string[] = [];
      const mockRecorder = {
        error: (msg: string) => errors.push(msg),
        warn: () => {},
        exception: () => {},
      };
      const response = JSON.stringify([{ invalid: "data" }]);
      const result = parseCategorizationResponse(response, mockRecorder);
      expect(result).toBeNull();
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("parseExtractionResponse", () => {
    it("should parse valid extraction response", () => {
      const response = JSON.stringify({
        responsible_entity: "Софийска вода",
        pins: [
          {
            address: "бул. Витоша 1",
            timespans: [
              { start: "2024-01-01T10:00:00Z", end: "2024-01-01T12:00:00Z" },
            ],
          },
        ],
        streets: [],
        cadastralProperties: [],
        markdown_text: "Test markdown",
      });
      const result = parseExtractionResponse(response);
      expect(result).not.toBeNull();
      expect(result!.responsible_entity).toBe("Софийска вода");
      expect(result!.pins).toHaveLength(1);
      expect(result!.markdown_text).toBe("Test markdown");
    });

    it("should return null if no JSON found", () => {
      const result = parseExtractionResponse("no json here");
      expect(result).toBeNull();
    });

    it("should return null for invalid JSON in matched text", async () => {
      const errors: string[] = [];
      const mockRecorder = {
        error: (msg: string) => errors.push(msg),
        warn: () => {},
        exception: () => {},
      };
      // Include valid JSON structure but with syntax error
      const result = parseExtractionResponse(
        '{ "invalid": json }',
        mockRecorder,
      );
      expect(result).toBeNull();
      expect(errors.length).toBeGreaterThan(0);
    });

    it("should handle missing optional fields", () => {
      const response = JSON.stringify({
        pins: [],
        streets: [],
        cadastralProperties: [],
      });
      const result = parseExtractionResponse(response);
      expect(result).not.toBeNull();
      expect(result!.responsible_entity).toBe("");
      expect(result!.markdown_text).toBe("");
    });

    it("should filter invalid items from arrays", () => {
      const response = JSON.stringify({
        pins: [
          {
            address: "valid",
            timespans: [
              { start: "2024-01-01T10:00:00Z", end: "2024-01-01T12:00:00Z" },
            ],
          },
          { address: "" }, // Empty address - should be filtered
          { timespans: [] }, // No address - should be filtered
        ],
        streets: [
          {
            street: "valid",
            from: "A",
            to: "B",
            timespans: [
              { start: "2024-01-01T10:00:00Z", end: "2024-01-01T12:00:00Z" },
            ],
          },
          { street: "invalid" }, // Missing from/to - should be filtered
        ],
        cadastralProperties: [
          {
            identifier: "valid",
            timespans: [
              { start: "2024-01-01T10:00:00Z", end: "2024-01-01T12:00:00Z" },
            ],
          },
          { identifier: "  " }, // Empty identifier - should be filtered
        ],
      });
      const result = parseExtractionResponse(response);
      expect(result).not.toBeNull();
      expect(result!.pins).toHaveLength(1);
      expect(result!.streets).toHaveLength(1);
      expect(result!.cadastralProperties).toHaveLength(1);
    });
  });
});
