import { Hono } from "hono";
import { SOURCES, getSofiaDateKey, shiftCalendarDate } from "@oboapp/shared";
import { getDb } from "../lib/db";
import { getRequiredLocality, LOCALITY_ENV_ERROR_MESSAGE } from "../lib/locality";
import { apiKeyAuth } from "../middleware/api-key";
import { rateLimit } from "../middleware/rate-limit";
import { usageMetrics } from "../middleware/usage-metrics";
import { SourceTimelineResponseSchema } from "../schema/response";

export const sourceTimelineRoute = new Hono();

sourceTimelineRoute.get(
  "/sources/:sourceId/timeline",
  apiKeyAuth,
  rateLimit,
  usageMetrics,
  async (c) => {
    const rawDays = c.req.query("days") ?? "90";
    const days = Number(rawDays);
    if (!/^\d+$/.test(rawDays) || !Number.isInteger(days) || days < 1 || days > 366) {
      return c.json({ error: "days must be an integer between 1 and 366" }, 400);
    }
    let locality: string;
    try {
      locality = getRequiredLocality();
    } catch {
      return c.json({ error: LOCALITY_ENV_ERROR_MESSAGE }, 500);
    }
    const source = SOURCES.find((candidate) => {
      return candidate.id === c.req.param("sourceId") && candidate.localities.includes(locality);
    });
    if (!source) {
      return c.json({ error: "Source not found" }, 404);
    }

    try {
      const db = await getDb();
      const current = await db.sourceSnapshots.findLatest(source.id, locality);
      const date = getSofiaDateKey(new Date());
      const from = shiftCalendarDate(date, 1 - days);
      const previousDate = current
        ? shiftCalendarDate(getSofiaDateKey(new Date(current.observedAt)), -1)
        : null;
      const [daily, previous] = await Promise.all([
        db.sourceDailyCounts.findRange(source.id, locality, from, date),
        previousDate
          ? db.sourceDailyCounts.findByDate(source.id, locality, previousDate)
          : Promise.resolve(null),
      ]);
      const response = SourceTimelineResponseSchema.parse({
        sourceType: source.id,
        locality,
        sourceUrl: source.url,
        current: current
          ? { count: current.count, observedAt: current.observedAt }
          : null,
        daily: daily.map((observation) => {
          return {
            date: observation.date,
            count: observation.count,
            observedAt: observation.observedAt,
          };
        }),
        comparison: current && previous
          ? {
              date: previous.date,
              count: previous.count,
              observedAt: previous.observedAt,
              change: current.count - previous.count,
            }
          : null,
      });
      c.header("Cache-Control", "private, max-age=60");
      return c.json(response);
    } catch (error) {
      console.error("Error fetching source timeline:", error);
      return c.json({ error: "Failed to fetch source timeline" }, 500);
    }
  },
);
