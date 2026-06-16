import type { Context, Next } from "hono";
import { getDb } from "../lib/db";
import { getApiPrincipal } from "./api-key";

const RATE_LIMIT_LIMIT_HEADER = "X-RateLimit-Limit";
const RATE_LIMIT_REMAINING_HEADER = "X-RateLimit-Remaining";
const RETRY_AFTER_HEADER = "Retry-After";

export function resolveRateLimitPerMinute(): number | null {
  const raw = process.env.PUBLIC_API_RATE_LIMIT_PER_MINUTE;
  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function startOfUtcMinute(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      0,
      0,
    ),
  );
}

export function secondsUntilNextMinute(now: Date): number {
  const minuteStart = startOfUtcMinute(now);
  const nextMinuteMs = minuteStart.getTime() + 60_000;
  const remainingMs = Math.max(0, nextMinuteMs - now.getTime());
  return Math.max(1, Math.ceil(remainingMs / 1000));
}

function setRateLimitHeaders(
  c: Context,
  limit: number,
  remaining: number,
): void {
  c.header(RATE_LIMIT_LIMIT_HEADER, String(limit));
  c.header(RATE_LIMIT_REMAINING_HEADER, String(Math.max(0, remaining)));
}

export function shouldExposeRateLimitHeaders(status: number): boolean {
  return (status >= 200 && status < 300) || status === 429;
}

export async function rateLimit(c: Context, next: Next) {
  const principal = getApiPrincipal(c);
  if (!principal) {
    await next();
    return;
  }

  const limit = resolveRateLimitPerMinute();
  if (limit === null) {
    await next();
    return;
  }

  const now = new Date();
  const periodStart = startOfUtcMinute(now).toISOString();

  let count: number;
  try {
    const db = await getDb();
    count = await db.apiRateLimitsMinute.incrementAndGetCount({
      principalId: principal.id,
      periodStart,
      nowIso: now.toISOString(),
    });
  } catch (error) {
    console.error("rateLimit: failed to update minute bucket", error);
    await next();
    return;
  }

  const remaining = Math.max(0, limit - count);
  if (count > limit) {
    setRateLimitHeaders(c, limit, remaining);
    c.header(RETRY_AFTER_HEADER, String(secondsUntilNextMinute(now)));
    return c.json({ error: "Rate limit exceeded. Please retry later." }, 429);
  }

  await next();

  if (shouldExposeRateLimitHeaders(c.res.status)) {
    setRateLimitHeaders(c, limit, remaining);
  }
}
