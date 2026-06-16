import { describe, it, expect } from "vitest";
import {
  makeBucketId,
  isAlreadyExistsError,
  statusClassField,
} from "./api-usage-hourly";

describe("api-usage-hourly pure helpers", () => {
  it("makeBucketId URL-encodes endpoint", () => {
    const id = makeBucketId({
      principalId: "user-1",
      periodStart: "2026-06-16T12:00:00.000Z",
      method: "GET",
      endpoint: "/v1/messages/by-id",
    });

    expect(id).toBe(
      "user-1:2026-06-16T12:00:00.000Z:GET:%2Fv1%2Fmessages%2Fby-id",
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
    expect(isAlreadyExistsError(new Error("timeout"))).toBe(false);
    expect(isAlreadyExistsError(11000 as unknown)).toBe(false);
  });

  it("statusClassField maps to expected counter field", () => {
    expect(statusClassField("2xx")).toBe("status2xxCount");
    expect(statusClassField("4xx")).toBe("status4xxCount");
    expect(statusClassField("5xx")).toBe("status5xxCount");
  });
});
