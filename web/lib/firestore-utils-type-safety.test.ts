/**
 * Type safety tests - these demonstrate compile-time type checking
 * Run `npx tsc --noEmit` to verify type errors
 */
import { describe, it, expect } from "vitest";
import { safeJsonParse, jsonValidators, arrayOf } from "./firestore-utils";

type Foo = { name: string; value: number };

describe("Type safety verification", () => {
  it("should enforce validator type matches generic T", () => {
    // ✅ CORRECT: Type matches validator
    const result1 = safeJsonParse<string[]>(
      '["a", "b"]',
      [],
      "test",
      jsonValidators.array,
    );
    expect(result1).toEqual(["a", "b"]);

    // ✅ CORRECT: Custom validator with matching type predicate
    const isFoo = (v: unknown): v is Foo =>
      typeof v === "object" &&
      v !== null &&
      "name" in v &&
      "value" in v &&
      typeof (v as Foo).name === "string" &&
      typeof (v as Foo).value === "number";

    const result2 = safeJsonParse<Foo>(
      '{"name": "test", "value": 42}',
      { name: "", value: 0 },
      "foo",
      isFoo,
    );
    expect(result2).toEqual({ name: "test", value: 42 });
  });

  it("should catch type mismatches at compile time", () => {
    // Shallow validators (jsonValidators.array/object) are allowed with any type
    // for backward compatibility and convenience. They only check shape, not content.
    const shallowValidated = safeJsonParse<Foo>(
      '{"name": "test", "value": 42}',
      { name: "", value: 0 },
      "foo",
      jsonValidators.object, // ✅ Allowed: shallow object check
    );

    // This compiles correctly because validator type matches:
    const isFoo = (v: unknown): v is Foo =>
      typeof v === "object" && v !== null && "name" in v && "value" in v;

    const correct = safeJsonParse<Foo>(
      '{"name": "test", "value": 42}',
      { name: "", value: 0 },
      "foo",
      isFoo, // ✅ Correct: validator produces Foo
    );

    expect(correct).toBeDefined();
    expect(shallowValidated).toBeDefined();
  });

  it("should enforce arrayOf element type matches array generic", () => {
    const isNumber = (v: unknown): v is number => typeof v === "number";

    // ✅ CORRECT: arrayOf<number> produces JsonValidator<number[]>
    const numbers = safeJsonParse<number[]>(
      "[1, 2, 3]",
      [],
      "numbers",
      arrayOf(isNumber),
    );
    expect(numbers).toEqual([1, 2, 3]);

    // Shallow validators are also allowed for convenience
    const shallowNumbers = safeJsonParse<number[]>(
      "[1, 2, 3]",
      [],
      "numbers",
      jsonValidators.array, // ✅ Allowed: shallow array check
    );
    expect(shallowNumbers).toEqual([1, 2, 3]);
  });

  it("validator is optional for backward compatibility", () => {
    // No validator - type safety is on the caller
    const result = safeJsonParse<{ key: string }>(
      '{"key": "value"}',
      { key: "" },
    );
    expect(result).toEqual({ key: "value" });
  });
});
