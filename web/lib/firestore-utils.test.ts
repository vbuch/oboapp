import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  convertTimestamp,
  safeJsonParse,
  jsonValidators,
  arrayOf,
} from "./firestore-utils";

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
    it("should return null as-is when no validator provided", () => {
      const result = safeJsonParse<{ key: string } | null>(null);

      expect(result).toBe(null);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should return undefined as-is when no validator provided", () => {
      const result = safeJsonParse<{ key: string } | undefined>(undefined);

      expect(result).toBe(undefined);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should return number as-is when no validator provided", () => {
      const result = safeJsonParse<number>(42);

      expect(result).toBe(42);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should return object as-is when no validator provided", () => {
      const input = { name: "test" };
      const result = safeJsonParse<{ name: string }>(input);

      expect(result).toBe(input);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should return array as-is when no validator provided", () => {
      const input = [1, 2, 3];
      const result = safeJsonParse<number[]>(input);

      expect(result).toBe(input);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should return boolean as-is when no validator provided", () => {
      const result = safeJsonParse<boolean>(true);

      expect(result).toBe(true);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should validate non-string array and accept valid arrays", () => {
      const input = ["a", "b", "c"];
      const result = safeJsonParse<string[]>(
        input,
        [],
        "alreadyArray",
        jsonValidators.array,
      );

      expect(result).toBe(input);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should validate non-string array and reject null with fallback", () => {
      const fallback: string[] = [];
      const result = safeJsonParse<string[]>(
        null,
        fallback,
        "nullInput",
        jsonValidators.array,
      );

      expect(result).toBe(fallback);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Validation failed for non-string value (nullInput): value does not match expected type",
        ),
      );
    });

    it("should validate non-string object and accept valid objects", () => {
      const input = { key: "value" };
      const result = safeJsonParse<Record<string, unknown>>(
        input,
        {},
        "alreadyObject",
        jsonValidators.object,
      );

      expect(result).toBe(input);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should validate non-string object and reject arrays with fallback", () => {
      const input = [1, 2, 3];
      const fallback = { default: true };
      const result = safeJsonParse<Record<string, unknown>>(
        input,
        fallback,
        "arrayNotObject",
        jsonValidators.object,
      );

      expect(result).toBe(fallback);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Validation failed for non-string value (arrayNotObject): value does not match expected type",
        ),
      );
    });

    it("should include context in validation failure log", () => {
      const fallback = { error: true };
      const context = "firestoreField";
      const result = safeJsonParse(
        123,
        fallback,
        context,
        jsonValidators.object,
      );

      expect(result).toBe(fallback);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Validation failed for non-string value (firestoreField): value does not match expected type",
        ),
      );
    });

    it("should work without context in validation failure log", () => {
      const fallback = null;
      const result = safeJsonParse(
        false,
        fallback,
        undefined,
        jsonValidators.array,
      );

      expect(result).toBe(null);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Validation failed for non-string value: value does not match expected type",
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

  describe("validation", () => {
    it("should validate array types and reject null", () => {
      const jsonString = "null";
      const fallback: string[] = [];
      const result = safeJsonParse<string[]>(
        jsonString,
        fallback,
        "testArray",
        jsonValidators.array,
      );

      expect(result).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "JSON validation failed (testArray): parsed value does not match expected type",
        ),
      );
    });

    it("should validate array types and accept valid arrays", () => {
      const jsonString = '["a", "b", "c"]';
      const result = safeJsonParse<string[]>(
        jsonString,
        [],
        "testArray",
        jsonValidators.array,
      );

      expect(result).toEqual(["a", "b", "c"]);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should validate object types and reject null", () => {
      const jsonString = "null";
      const result = safeJsonParse<Record<string, unknown>>(
        jsonString,
        undefined,
        "testObject",
        jsonValidators.object,
      );

      expect(result).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "JSON validation failed (testObject): parsed value does not match expected type",
        ),
      );
    });

    it("should validate object types and reject arrays", () => {
      const jsonString = '[{"name": "test"}]';
      const fallback = { default: true };
      const result = safeJsonParse<Record<string, unknown>>(
        jsonString,
        fallback,
        "testObject",
        jsonValidators.object,
      );

      expect(result).toEqual({ default: true });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "JSON validation failed (testObject): parsed value does not match expected type",
        ),
      );
    });

    it("should validate object types and accept valid objects", () => {
      const jsonString = '{"key": "value"}';
      const result = safeJsonParse<Record<string, unknown>>(
        jsonString,
        undefined,
        "testObject",
        jsonValidators.object,
      );

      expect(result).toEqual({ key: "value" });
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should validate objectOrArray and accept both", () => {
      const objString = '{"key": "value"}';
      const arrString = "[1, 2, 3]";

      const objResult = safeJsonParse(
        objString,
        undefined,
        "test",
        jsonValidators.objectOrArray,
      );
      const arrResult = safeJsonParse(
        arrString,
        undefined,
        "test",
        jsonValidators.objectOrArray,
      );

      expect(objResult).toEqual({ key: "value" });
      expect(arrResult).toEqual([1, 2, 3]);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should validate objectOrArray and reject primitives", () => {
      const primitiveString = '"string"';
      const result = safeJsonParse(
        primitiveString,
        { fallback: true },
        "test",
        jsonValidators.objectOrArray,
      );

      expect(result).toEqual({ fallback: true });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "JSON validation failed (test): parsed value does not match expected type",
        ),
      );
    });

    it("should work with custom validators", () => {
      type User = { id: number; name: string };
      const isUser = (value: unknown): value is User =>
        typeof value === "object" &&
        value !== null &&
        "id" in value &&
        "name" in value &&
        typeof (value as { id: unknown }).id === "number" &&
        typeof (value as { name: unknown }).name === "string";

      const validJson = '{"id": 1, "name": "Alice"}';
      const invalidJson = '{"id": "not-a-number", "name": "Bob"}';

      const validResult = safeJsonParse<User>(
        validJson,
        { id: 0, name: "Unknown" },
        "user",
        isUser,
      );
      const invalidResult = safeJsonParse<User>(
        invalidJson,
        { id: 0, name: "Unknown" },
        "user",
        isUser,
      );

      expect(validResult).toEqual({ id: 1, name: "Alice" });
      expect(invalidResult).toEqual({ id: 0, name: "Unknown" });
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "JSON validation failed (user): parsed value does not match expected type",
        ),
      );
    });

    it("should work without validator (backward compatibility)", () => {
      const jsonString = "null";
      const result = safeJsonParse<string[]>(jsonString, []);

      // Without validator, null is accepted (backward compatible behavior)
      expect(result).toBe(null);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should not validate when validator not provided", () => {
      const jsonString = '"string"';
      const result = safeJsonParse<string[]>(jsonString);

      // Without validator, type mismatch is not caught
      expect(result).toBe("string");
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });
});

describe("arrayOf", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it("should accept an array where all elements pass the item validator", () => {
    const isNumber = (v: unknown): boolean => typeof v === "number";
    const result = safeJsonParse<number[]>(
      "[1, 2, 3]",
      [],
      "numbers",
      arrayOf(isNumber),
    );

    expect(result).toEqual([1, 2, 3]);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it("should reject an array where some elements fail the item validator", () => {
    const isNumber = (v: unknown): boolean => typeof v === "number";
    const result = safeJsonParse<number[]>(
      '[1, "two", 3]',
      [],
      "numbers",
      arrayOf(isNumber),
    );

    expect(result).toEqual([]);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("JSON validation failed (numbers)"),
    );
  });

  it("should reject non-array values", () => {
    const isNumber = (v: unknown): boolean => typeof v === "number";
    const result = safeJsonParse<number[]>(
      '{"not": "array"}',
      [],
      "numbers",
      arrayOf(isNumber),
    );

    expect(result).toEqual([]);
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it("should accept empty arrays", () => {
    const isNumber = (v: unknown): boolean => typeof v === "number";
    const result = safeJsonParse<number[]>(
      "[]",
      [999],
      "numbers",
      arrayOf(isNumber),
    );

    expect(result).toEqual([]);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it("should work with object element validators", () => {
    type Item = { id: number; name: string };
    const isItem = (v: unknown): boolean =>
      typeof v === "object" &&
      v !== null &&
      "id" in v &&
      "name" in v &&
      typeof (v as Item).id === "number" &&
      typeof (v as Item).name === "string";

    const validJson = '[{"id": 1, "name": "A"}, {"id": 2, "name": "B"}]';
    const invalidJson = '[{"id": 1, "name": "A"}, {"id": "bad"}]';

    const validResult = safeJsonParse<Item[]>(
      validJson,
      [],
      "items",
      arrayOf(isItem),
    );
    const invalidResult = safeJsonParse<Item[]>(
      invalidJson,
      [],
      "items",
      arrayOf(isItem),
    );

    expect(validResult).toEqual([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);
    expect(invalidResult).toEqual([]);
  });

  it("should work with already-deserialized arrays", () => {
    const isString = (v: unknown): boolean => typeof v === "string";
    const input = ["a", "b", "c"];
    const result = safeJsonParse<string[]>(
      input,
      [],
      "strings",
      arrayOf(isString),
    );

    expect(result).toBe(input);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});
