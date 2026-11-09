import { Hono } from "hono";
import { SOURCES, getSofiaDateKey, shiftCalendarDate, validateCalendarDate } from "@oboapp/shared";
import { getDb } from "../lib/db";
import { incidentTransitions } from "../lib/incident-transitions";
import { getRequiredLocality, LOCALITY_ENV_ERROR_MESSAGE } from "../lib/locality";
import { apiKeyAuth } from "../middleware/api-key";
import { rateLimit } from "../middleware/rate-limit";
import { usageMetrics } from "../middleware/usage-metrics";
import { SourceIncidentChangesResponseSchema } from "../schema/response";

export const sourceIncidentChangesRoute = new Hono();

function supportedDate(date: string, today: string): boolean {
  try {
    validateCalendarDate(date);
    return date >= "0001-01-02" && date <= today;
  } catch {
    return false;
  }
}

sourceIncidentChangesRoute.get(
  "/sources/:sourceId/incident-changes",
  apiKeyAuth,
  rateLimit,
  usageMetrics,
  async (c) => {
    const now = new Date();
    const today = getSofiaDateKey(now);
    const dates = c.req.queries("date") ?? [];
    const date = dates[0] ?? today;
    if (dates.length > 1 || !supportedDate(date, today)) {
      return c.json({ error: "date must be a single valid YYYY-MM-DD calendar date between 0001-01-02 and today in Europe/Sofia" }, 400);
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
    if (!source || source.id !== "toplo-bg") {
      return c.json({ error: "Incident changes are not configured for this source and locality" }, 404);
    }
    try {
      const db = await getDb();
      const baselineDate = shiftCalendarDate(date, -1);
      const [baseline, end, latest] = await Promise.all([
        db.sourceSnapshots.findLatestForDate(source.id, locality, baselineDate),
        db.sourceSnapshots.findLatestForDate(source.id, locality, date),
        date === today ? db.sourceSnapshots.findLatest(source.id, locality) : Promise.resolve(null),
      ]);
      const history = baseline && end
        ? await db.sourceSnapshots.findRange(source.id, locality, baseline.observedAt, end.observedAt)
        : { snapshots: [], truncated: false };
      const response = SourceIncidentChangesResponseSchema.parse({
        sourceType: source.id,
        locality,
        sourceUrl: source.url,
        date,
        baselineDate,
        baseline,
        end,
        ...incidentTransitions(baseline, end, history, latest, now, date === today),
      });
      c.header("Cache-Control", "private, max-age=60");
      return c.json(response);
    } catch (error) {
      console.error("Error fetching incident changes:", error);
      return c.json({ error: "Failed to fetch incident changes" }, 500);
    }
  },
);
