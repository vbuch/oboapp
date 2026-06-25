import { describe, beforeEach, afterAll, it, expect, vi } from "vitest";
import type { Message } from "../schema/contract";
import {
  clearMessagesRouteCache,
  getAggressiveCacheTtlSeconds,
  getUnboundMessagesCacheKey,
  getCachedUnboundMessages,
  setCachedUnboundMessages,
  shouldApplyAggressiveCache,
} from "./messages";

describe("messages route pure helpers", () => {
  const ORIGINAL_CACHE_TTL =
    process.env.PUBLIC_API_MESSAGES_AGGRESSIVE_CACHE_TTL_SECONDS;
  const ORIGINAL_DEFAULT_LIMIT = process.env.PUBLIC_API_MESSAGES_DEFAULT_LIMIT;

  beforeEach(() => {
    clearMessagesRouteCache();
    delete process.env.PUBLIC_API_MESSAGES_AGGRESSIVE_CACHE_TTL_SECONDS;
    delete process.env.PUBLIC_API_MESSAGES_DEFAULT_LIMIT;
    vi.useRealTimers();
  });

  afterAll(() => {
    clearMessagesRouteCache();
    vi.useRealTimers();

    if (ORIGINAL_CACHE_TTL === undefined) {
      delete process.env.PUBLIC_API_MESSAGES_AGGRESSIVE_CACHE_TTL_SECONDS;
    } else {
      process.env.PUBLIC_API_MESSAGES_AGGRESSIVE_CACHE_TTL_SECONDS =
        ORIGINAL_CACHE_TTL;
    }

    if (ORIGINAL_DEFAULT_LIMIT === undefined) {
      delete process.env.PUBLIC_API_MESSAGES_DEFAULT_LIMIT;
    } else {
      process.env.PUBLIC_API_MESSAGES_DEFAULT_LIMIT = ORIGINAL_DEFAULT_LIMIT;
    }
  });

  it("returns default aggressive cache TTL when env is missing", () => {
    expect(getAggressiveCacheTtlSeconds()).toBe(3600);
  });

  it("returns aggressive cache TTL from env when valid", () => {
    process.env.PUBLIC_API_MESSAGES_AGGRESSIVE_CACHE_TTL_SECONDS = "120";
    expect(getAggressiveCacheTtlSeconds()).toBe(120);
  });

  it("falls back to default aggressive cache TTL when env is invalid", () => {
    process.env.PUBLIC_API_MESSAGES_AGGRESSIVE_CACHE_TTL_SECONDS = "0";
    expect(getAggressiveCacheTtlSeconds()).toBe(3600);
  });

  it("includes locality and default limit in cache key", () => {
    process.env.PUBLIC_API_MESSAGES_DEFAULT_LIMIT = "321";
    expect(getUnboundMessagesCacheKey("bg.sofia")).toBe("bg.sofia:321");
  });

  it("stores and retrieves cached messages before expiry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));

    const cacheKey = "bg.sofia:200";
    const messages = [
      {
        id: "m1",
        text: "Hello",
        locality: "bg.sofia",
        createdAt: "2026-01-01T10:00:00.000Z",
      },
    ] as Message[];

    setCachedUnboundMessages(cacheKey, messages);

    expect(getCachedUnboundMessages(cacheKey)).toEqual(messages);
  });

  it("evicts stale cached messages", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));

    const cacheKey = "bg.sofia:200";
    const messages = [
      {
        id: "m2",
        text: "Hello",
        locality: "bg.sofia",
        createdAt: "2026-01-01T10:00:00.000Z",
      },
    ] as Message[];

    setCachedUnboundMessages(cacheKey, messages);
    vi.setSystemTime(new Date("2026-01-01T11:01:00.000Z"));

    expect(getCachedUnboundMessages(cacheKey)).toBeNull();
  });

  it("applies aggressive cache only for unbound request shape", () => {
    expect(
      shouldApplyAggressiveCache({
        hasCategoryFilter: false,
        hasSourceFilter: false,
        hasViewport: false,
      }),
    ).toBe(true);

    expect(
      shouldApplyAggressiveCache({
        hasCategoryFilter: true,
        hasSourceFilter: false,
        hasViewport: false,
      }),
    ).toBe(false);

    expect(
      shouldApplyAggressiveCache({
        hasCategoryFilter: false,
        hasSourceFilter: false,
        hasViewport: false,
        limit: 25,
      }),
    ).toBe(false);
  });
});
