/**
 * Type safety tests - these demonstrate compile-time type checking
 * Run `npx tsc --noEmit` to verify type errors
 */
import { describe, it, expect } from "vitest";
import { safeJsonParse } from "./firestore-utils";

type Foo = { name: string; value: number };

describe("Type safety verification", () => {
  it("should parse JSON without runtime validation", () => {
    const result1 = safeJsonParse<string[]>('["a", "b"]', []);
    expect(result1).toEqual(["a", "b"]);

    const result2 = safeJsonParse<Foo>('{"name": "test", "value": 42}', {
      name: "",
      value: 0,
    });
    expect(result2).toEqual({ name: "test", value: 42 });
  });

  it("should allow optional context parameter", () => {
    const result = safeJsonParse<{ key: string }>(
      '{"key": "value"}',
      { key: "" },
      "testContext",
    );
    expect(result).toEqual({ key: "value" });
  });

  it("should handle already-deserialized values", () => {
    const alreadyParsed = { name: "test", value: 42 };
    const result = safeJsonParse<Foo>(alreadyParsed, { name: "", value: 0 });
    expect(result).toBe(alreadyParsed);
  });
});
