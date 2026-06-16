import { describe, it, expect } from "vitest";
import { makeBucketId, isAlreadyExistsError } from "./api-rate-limits-minute";

describe("api-rate-limits-minute pure helpers", () => {
  it("makeBucketId combines principal and period", () => {
    expect(makeBucketId("user-1", "2026-06-16T12:34:00.000Z")).toBe(
      "user-1:2026-06-16T12:34:00.000Z",
    );
  });

  it("isAlreadyExistsError returns true for known duplicate indicators", () => {
    expect(isAlreadyExistsError(new Error("document already exists"))).toBe(
      true,
    );
    expect(isAlreadyExistsError(new Error("ALREADY_EXISTS"))).toBe(true);

    const code6 = new Error("db");
    (code6 as Error & { code?: unknown }).code = 6;
    expect(isAlreadyExistsError(code6)).toBe(true);

    const code11000 = new Error("duplicate key");
    (code11000 as Error & { code?: unknown }).code = 11000;
    expect(isAlreadyExistsError(code11000)).toBe(true);
  });

  it("isAlreadyExistsError returns false for unrelated input", () => {
    expect(isAlreadyExistsError(new Error("connection refused"))).toBe(false);
    expect(isAlreadyExistsError("already exists" as unknown)).toBe(false);
    expect(isAlreadyExistsError(null)).toBe(false);
  });
});
