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

  describe("non-string input handling (already-deserialized values)", () => {
    it("should return null as-is", () => {
      const result = safeJsonParse<{ key: string } | null>(null);

      expect(result).toBe(null);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should return undefined as-is", () => {
      const result = safeJsonParse<{ key: string } | undefined>(undefined);

      expect(result).toBe(undefined);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should return number as-is", () => {
      const result = safeJsonParse<number>(42);

      expect(result).toBe(42);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should return object as-is", () => {
      const input = { name: "test" };
      const result = safeJsonParse<{ name: string }>(input);

      expect(result).toBe(input);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should return array as-is", () => {
      const input = [1, 2, 3];
      const result = safeJsonParse<number[]>(input);

      expect(result).toBe(input);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should return boolean as-is", () => {
      const result = safeJsonParse<boolean>(true);

      expect(result).toBe(true);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
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
