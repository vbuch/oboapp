import { describe, it, expect, afterEach } from "vitest";
import {
  resolveRateLimitPerMinute,
  startOfUtcMinute,
  secondsUntilNextMinute,
  shouldExposeRateLimitHeaders,
} from "./rate-limit";

const ENV_KEY = "PUBLIC_API_RATE_LIMIT_PER_MINUTE";
const originalEnv = process.env[ENV_KEY];

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env[ENV_KEY];
    return;
  }
  process.env[ENV_KEY] = originalEnv;
});

describe("rate-limit pure helpers", () => {
  describe("resolveRateLimitPerMinute", () => {
    it("returns null when env is missing", () => {
      delete process.env[ENV_KEY];
      expect(resolveRateLimitPerMinute()).toBeNull();
    });

    it("returns parsed positive integer when env is valid", () => {
      process.env[ENV_KEY] = "120";
      expect(resolveRateLimitPerMinute()).toBe(120);
    });

    it("returns null for non-numeric env", () => {
      process.env[ENV_KEY] = "abc";
      expect(resolveRateLimitPerMinute()).toBeNull();
    });

    it("returns null for zero or negative env", () => {
      process.env[ENV_KEY] = "0";
      expect(resolveRateLimitPerMinute()).toBeNull();

      process.env[ENV_KEY] = "-5";
      expect(resolveRateLimitPerMinute()).toBeNull();
    });
  });

  it("startOfUtcMinute truncates seconds and milliseconds", () => {
    const input = new Date("2026-06-16T12:34:56.789Z");
    expect(startOfUtcMinute(input).toISOString()).toBe(
      "2026-06-16T12:34:00.000Z",
    );
  });

  it("secondsUntilNextMinute returns expected rounded-up seconds", () => {
    const input = new Date("2026-06-16T12:34:56.100Z");
    expect(secondsUntilNextMinute(input)).toBe(4);
  });

  it("secondsUntilNextMinute is always at least 1", () => {
    const input = new Date("2026-06-16T12:34:59.999Z");
    expect(secondsUntilNextMinute(input)).toBe(1);
  });

  it("shouldExposeRateLimitHeaders returns true only for 2xx and 429", () => {
    expect(shouldExposeRateLimitHeaders(200)).toBe(true);
    expect(shouldExposeRateLimitHeaders(204)).toBe(true);
    expect(shouldExposeRateLimitHeaders(429)).toBe(true);

    expect(shouldExposeRateLimitHeaders(400)).toBe(false);
    expect(shouldExposeRateLimitHeaders(500)).toBe(false);
  });
});
