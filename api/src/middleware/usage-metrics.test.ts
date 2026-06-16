import { describe, it, expect } from "vitest";
import { startOfUtcHour, toStatusClass } from "./usage-metrics";

describe("usage-metrics pure helpers", () => {
  it("startOfUtcHour truncates minutes, seconds, and milliseconds", () => {
    const input = new Date("2026-06-16T12:34:56.789Z");
    expect(startOfUtcHour(input).toISOString()).toBe(
      "2026-06-16T12:00:00.000Z",
    );
  });

  it("toStatusClass maps status codes to non-error/error classes", () => {
    expect(toStatusClass(200)).toBe("2xx");
    expect(toStatusClass(299)).toBe("2xx");
    expect(toStatusClass(304)).toBe("2xx");
    expect(toStatusClass(400)).toBe("4xx");
    expect(toStatusClass(499)).toBe("4xx");
    expect(toStatusClass(500)).toBe("5xx");
    expect(toStatusClass(599)).toBe("5xx");
  });
});
