import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convertTimestamp, safeJsonParse } from "./firestore-utils";

describe("convertTimestamp", () => {
  beforeEach(() => {
    // Mock current time to ensure consistent test results
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should convert Firestore timestamp with _seconds property to ISO string", () => {
    const firestoreTimestamp = {
      _seconds: 1705320000, // 2024-01-15T12:00:00.000Z
      _nanoseconds: 0,
    };

    const result = convertTimestamp(firestoreTimestamp);

    expect(result).toBe("2024-01-15T12:00:00.000Z");
  });

  it("should handle Firestore timestamp with non-zero nanoseconds", () => {
    const firestoreTimestamp = {
      _seconds: 1705320000,
      _nanoseconds: 500000000, // 500ms, but should be ignored in current implementation
    };

    const result = convertTimestamp(firestoreTimestamp);

    // Current implementation only uses _seconds
    expect(result).toBe("2024-01-15T12:00:00.000Z");
  });

  it("should convert Firestore timestamp with toDate method to ISO string", () => {
    const mockDate = new Date("2024-06-20T15:30:00.000Z");
    const firestoreTimestamp = {
      toDate: () => mockDate,
    };

    const result = convertTimestamp(firestoreTimestamp);

    expect(result).toBe("2024-06-20T15:30:00.000Z");
  });

  it("should return ISO string if timestamp is already a string", () => {
    const isoString = "2024-03-10T10:00:00.000Z";

    const result = convertTimestamp(isoString);

    expect(result).toBe(isoString);
  });

  it("should return current date ISO string if timestamp is null", () => {
    const result = convertTimestamp(null);

    expect(result).toBe("2025-01-15T12:00:00.000Z");
  });

  it("should return current date ISO string if timestamp is undefined", () => {
    const result = convertTimestamp(undefined);

    expect(result).toBe("2025-01-15T12:00:00.000Z");
  });

  it("should return current date ISO string if timestamp is empty string", () => {
    const result = convertTimestamp("");

    expect(result).toBe("2025-01-15T12:00:00.000Z");
  });

  it("should prioritize _seconds over toDate if both exist", () => {
    const timestamp = {
      _seconds: 1705320000, // 2024-01-15T12:00:00.000Z
      toDate: () => new Date("2024-06-20T15:30:00.000Z"),
    };

    const result = convertTimestamp(timestamp);

    // _seconds should be checked first
    expect(result).toBe("2024-01-15T12:00:00.000Z");
  });

  it("should handle zero timestamp (Unix epoch)", () => {
    const firestoreTimestamp = {
      _seconds: 0,
      _nanoseconds: 0,
    };

    const result = convertTimestamp(firestoreTimestamp);

    expect(result).toBe("1970-01-01T00:00:00.000Z");
  });

  it("should handle negative timestamp (before Unix epoch)", () => {
    const firestoreTimestamp = {
      _seconds: -86400, // 1969-12-31T00:00:00.000Z
      _nanoseconds: 0,
    };

    const result = convertTimestamp(firestoreTimestamp);

    expect(result).toBe("1969-12-31T00:00:00.000Z");
  });
});

describe("safeJsonParse", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe("successful parsing", () => {
    it("should parse valid JSON object", () => {
      const jsonString = '{"name": "Sofia", "population": 1236000}';
      const result = safeJsonParse<{ name: string; population: number }>(
        jsonString,
      );

      expect(result).toEqual({ name: "Sofia", population: 1236000 });
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should parse valid JSON array", () => {
      const jsonString = '["apple", "banana", "cherry"]';
      const result = safeJsonParse<string[]>(jsonString);

      expect(result).toEqual(["apple", "banana", "cherry"]);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should parse valid JSON string", () => {
      const jsonString = '"hello world"';
      const result = safeJsonParse<string>(jsonString);

      expect(result).toBe("hello world");
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should parse valid JSON number", () => {
      const jsonString = "42";
      const result = safeJsonParse<number>(jsonString);

      expect(result).toBe(42);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should parse valid JSON boolean", () => {
      const jsonString = "true";
      const result = safeJsonParse<boolean>(jsonString);

      expect(result).toBe(true);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should parse null", () => {
      const jsonString = "null";
      const result = safeJsonParse<null>(jsonString);

      expect(result).toBe(null);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe("invalid JSON handling", () => {
    it("should return undefined fallback for invalid JSON when no fallback provided", () => {
      const invalidJson = '{"name": "incomplete';
      const result = safeJsonParse<{ name: string }>(invalidJson);

      expect(result).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to parse JSON"),
        expect.anything(),
      );
    });

    it("should return provided fallback for invalid JSON", () => {
      const invalidJson = '{"invalid": json}';
      const fallback = { default: true };
      const result = safeJsonParse(invalidJson, fallback);

      expect(result).toEqual({ default: true });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to parse JSON"),
        expect.anything(),
      );
    });

    it("should include context in log message when parsing fails", () => {
      const invalidJson = "[1, 2,";
      const fallback = [] as number[];
      const context = "userPreferences";
      const result = safeJsonParse(invalidJson, fallback, context);

      expect(result).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to parse JSON (userPreferences)"),
        expect.anything(),
      );
    });

    it("should log without context when none provided", () => {
      const invalidJson = "not valid json";
      const result = safeJsonParse(invalidJson, { fallback: "value" });

      expect(result).toEqual({ fallback: "value" });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to parse JSON:",
        expect.anything(),
      );
    });
  });

  describe("non-string input handling", () => {
    it("should return undefined fallback for null input when no fallback provided", () => {
      const result = safeJsonParse<{ key: string }>(null);

      expect(result).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Expected string for JSON parsing, got object"),
      );
    });

    it("should return provided fallback for null input", () => {
      const fallback = { default: "value" };
      const result = safeJsonParse(null, fallback);

      expect(result).toEqual({ default: "value" });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Expected string for JSON parsing, got object"),
      );
    });

    it("should return fallback for undefined input", () => {
      const fallback = { empty: true };
      const result = safeJsonParse(undefined, fallback);

      expect(result).toEqual({ empty: true });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Expected string for JSON parsing, got undefined",
        ),
      );
    });

    it("should return fallback for number input", () => {
      const fallback = { type: "number" };
      const result = safeJsonParse(42, fallback);

      expect(result).toEqual({ type: "number" });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Expected string for JSON parsing, got number"),
      );
    });

    it("should return fallback for object input", () => {
      const fallback = { type: "object" };
      const result = safeJsonParse({ name: "test" }, fallback);

      expect(result).toEqual({ type: "object" });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Expected string for JSON parsing, got object"),
      );
    });

    it("should return fallback for array input", () => {
      const fallback = { type: "array" };
      const result = safeJsonParse([1, 2, 3], fallback);

      expect(result).toEqual({ type: "array" });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Expected string for JSON parsing, got object"),
      );
    });

    it("should return fallback for boolean input", () => {
      const fallback = { type: "boolean" };
      const result = safeJsonParse(true, fallback);

      expect(result).toEqual({ type: "boolean" });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Expected string for JSON parsing, got boolean",
        ),
      );
    });

    it("should include context in log for non-string input", () => {
      const fallback = { error: true };
      const context = "configField";
      const result = safeJsonParse(123, fallback, context);

      expect(result).toEqual({ error: true });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Expected string for JSON parsing (configField), got number",
        ),
      );
    });

    it("should log without context for non-string input when none provided", () => {
      const fallback = null;
      const result = safeJsonParse(false, fallback);

      expect(result).toBe(null);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Expected string for JSON parsing, got boolean",
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty string", () => {
      // Empty string is invalid JSON (must be quoted for string literal)
      const result = safeJsonParse<string>("", "default");

      expect(result).toBe("default");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to parse JSON"),
        expect.anything(),
      );
    });

    it("should handle whitespace-only string", () => {
      const result = safeJsonParse<string>("   ", "default");

      expect(result).toBe("default");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to parse JSON"),
        expect.anything(),
      );
    });

    it("should handle complex nested objects", () => {
      const complexJson = JSON.stringify({
        level1: {
          level2: {
            level3: {
              data: [1, 2, 3],
              metadata: { timestamp: "2025-01-15" },
            },
          },
        },
      });

      const result = safeJsonParse<{
        level1: { level2: { level3: { data: number[] } } };
      }>(complexJson);

      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              data: [1, 2, 3],
              metadata: { timestamp: "2025-01-15" },
            },
          },
        },
      });
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });
});
