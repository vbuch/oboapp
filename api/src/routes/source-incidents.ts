import { Hono } from "hono";
import {
  SOURCES,
  getSofiaDateKey,
  validateCalendarDate,
  type SourceIncident,
} from "@oboapp/shared";
import { getDb } from "../lib/db";
import { getRequiredLocality, LOCALITY_ENV_ERROR_MESSAGE } from "../lib/locality";
import { apiKeyAuth } from "../middleware/api-key";
import { rateLimit } from "../middleware/rate-limit";
import { usageMetrics } from "../middleware/usage-metrics";
import { SourceIncidentsResponseSchema } from "../schema/response";

export const sourceIncidentsRoute = new Hono();

const incidentNameCollator = new Intl.Collator("bg");
const invalidDateMessage =
  "date must be a single valid calendar date in YYYY-MM-DD format between 0001-01-01 and today in Europe/Sofia";

function isSupportedDate(date: string): boolean {
  try {
    validateCalendarDate(date);
    return date <= getSofiaDateKey(new Date());
  } catch {
    return false;
  }
}

function compareIncidents(first: SourceIncident, second: SourceIncident): number {
  const firstStart = first.reportedStart
    ? Date.parse(first.reportedStart)
    : Number.POSITIVE_INFINITY;
  const secondStart = second.reportedStart
    ? Date.parse(second.reportedStart)
    : Number.POSITIVE_INFINITY;
  if (firstStart !== secondStart) {
    return firstStart - secondStart;
  }
  const nameOrder = incidentNameCollator.compare(first.name, second.name);
  if (nameOrder !== 0) {
    return nameOrder;
  }
  if (first.id < second.id) {
    return -1;
  }
  return first.id > second.id ? 1 : 0;
}

function dateOrNull(value: unknown): string | null {
  if (!(typeof value === "string" || value instanceof Date)) {
    return null;
  }
  if (typeof value === "string" && !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return null;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function sourceUrl(id: string): string {
  return `https://toplo.bg/incidents/${id}`;
}

function firstObservations(records: Record<string, unknown>[], locality: string) {
  const firstByUrl = new Map<string, Record<string, unknown>>();
  for (const record of records) {
    if (
      record.sourceType !== "toplo-bg" || record.locality !== locality ||
      typeof record.url !== "string"
    ) {
      continue;
    }
    const previous = firstByUrl.get(record.url);
    const observedAt = dateOrNull(record.crawledAt);
    const previousAt = dateOrNull(previous?.crawledAt);
    if (!previous || (observedAt && (!previousAt || observedAt < previousAt))) {
      firstByUrl.set(record.url, record);
    }
  }
  return firstByUrl;
}

function addFirstObservation(incident: SourceIncident, first: Record<string, unknown> | undefined) {
  const firstReportedStart = dateOrNull(first?.timespanStart);
  const savedEnd = dateOrNull(first?.timespanEnd);
  // The legacy crawler substituted the start when an estimate was unavailable.
  const firstEstimatedEnd = savedEnd === firstReportedStart ? null : savedEnd;
  return {
    ...incident,
    firstObservedAt: dateOrNull(first?.crawledAt),
    firstReportedStart,
    firstEstimatedEnd,
  };
}

sourceIncidentsRoute.get(
  "/sources/:sourceId/incidents",
  apiKeyAuth,
  rateLimit,
  usageMetrics,
  async (c) => {
    const dates = c.req.queries("date") ?? [];
    const date = dates[0];
    if (dates.length > 1 || (date !== undefined && !isSupportedDate(date))) {
      return c.json({ error: invalidDateMessage }, 400);
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
      return c.json({ error: "Source incident listing is not configured for this locality" }, 404);
    }
    try {
      const db = await getDb();
      const snapshot = date === undefined
        ? await db.sourceSnapshots.findLatest(source.id, locality)
        : await db.sourceSnapshots.findLatestForDate(source.id, locality, date);
      if (!snapshot?.incidents) {
        const error = date === undefined
          ? "No complete incident listing is available yet"
          : "No complete incident listing is available for the requested date";
        return c.json({ error }, 503);
      }
      const incidents = date === undefined
        ? snapshot.incidents
        : [...snapshot.incidents].sort(compareIncidents);
      const records = await db.sources.findByUrls(snapshot.incidents.map((incident) => {
        return sourceUrl(incident.id);
      }));
      const firstByUrl = firstObservations(records, locality);
      const response = SourceIncidentsResponseSchema.parse({
        sourceType: source.id,
        locality,
        sourceUrl: source.url,
        observedAt: snapshot.observedAt,
        count: snapshot.count,
        incidents: incidents.map((incident) => {
          return addFirstObservation(incident, firstByUrl.get(sourceUrl(incident.id)));
        }),
      });
      c.header("Cache-Control", "private, max-age=60");
      return c.json(response);
    } catch (error) {
      console.error("Error fetching source incidents:", error);
      return c.json({ error: "Failed to fetch source incidents" }, 500);
    }
  },
);
