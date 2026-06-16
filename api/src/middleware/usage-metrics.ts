import type { Context, Next } from "hono";
import { getDb } from "../lib/db";
import { getApiPrincipal } from "./api-key";

export type StatusClass = "2xx" | "4xx" | "5xx";

export function startOfUtcHour(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      0,
      0,
      0,
    ),
  );
}

export function toStatusClass(status: number): StatusClass {
  if (status >= 500 && status < 600) {
    return "5xx";
  }
  if (status >= 400 && status < 500) {
    return "4xx";
  }
  if (status >= 200 && status < 400) {
    return "2xx";
  }
  return "2xx";
}

export async function usageMetrics(c: Context, next: Next) {
  const principal = getApiPrincipal(c);
  if (!principal) {
    await next();
    return;
  }

  await next();

  const now = new Date();
  const method = c.req.method.toUpperCase();
  const endpoint = c.req.path;
  const statusClass = toStatusClass(c.res.status);

  try {
    const db = await getDb();
    await db.apiUsageHourly.increment({
      principalId: principal.id,
      principalType: principal.type,
      method,
      endpoint,
      periodStart: startOfUtcHour(now).toISOString(),
      statusClass,
      nowIso: now.toISOString(),
    });
  } catch (error) {
    console.error("usageMetrics: failed to increment hourly usage", error);
  }
}
