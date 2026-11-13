import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenAPIObject } from "openapi3-ts/oas30";
import app from "../index";
import { getDb } from "../lib/db";
import type { SourceIncidentsResponse } from "../schema/response";

vi.mock("../lib/db", () => ({ getDb: vi.fn() }));

const endpoint = "/v1/sources/toplo-bg/incidents";
const headers = { "X-Api-Key": "incidents-test" };
const incident = {
  id: "one",
  accidentId: "accident-one",
  name: "Част от Яворов",
  addresses: "Цар Иван Асен II 42",
  type: "accident",
  status: 1,
  reportedStart: "2025-11-04T15:00:00Z",
  estimatedEnd: "2026-11-15T20:00:00Z",
  createdAt: "2025-11-04T13:20:43Z",
};
const snapshot = {
  sourceType: "toplo-bg",
  locality: "bg.sofia",
  count: 1,
  observedAt: "2026-11-11T15:00:00.000Z",
  incidents: [incident],
};
const firstSource = {
  url: "https://toplo.bg/incidents/one",
  sourceType: "toplo-bg",
  locality: "bg.sofia",
  crawledAt: new Date("2026-02-06T19:01:12.027Z"),
  timespanStart: new Date("2025-11-04T15:00:00Z"),
  timespanEnd: new Date("2026-02-27T20:00:00Z"),
};
const findLatest = vi.fn();
const findLatestForDate = vi.fn();
const findByUrls = vi.fn();
const rateLimitCount = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-13T12:00:00Z"));
  vi.stubEnv("PUBLIC_API_KEYS", "incidents-test");
  vi.stubEnv("LOCALITY", "bg.sofia");
  vi.stubEnv("PUBLIC_API_RATE_LIMIT_PER_MINUTE", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  findLatest.mockResolvedValue(snapshot);
  findLatestForDate.mockResolvedValue(snapshot);
  findByUrls.mockResolvedValue([firstSource]);
  rateLimitCount.mockResolvedValue(1);
  vi.mocked(getDb).mockResolvedValue({
    sourceSnapshots: { findLatest, findLatestForDate },
    sources: { findByUrls },
    apiUsageHourly: { increment: vi.fn().mockResolvedValue(undefined) },
    apiRateLimitsMinute: { incrementAndGetCount: rateLimitCount },
    apiClients: { findByApiKey: vi.fn().mockResolvedValue(null) },
  } as unknown as Awaited<ReturnType<typeof getDb>>);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("source incident listing", () => {
  it("authenticates before reading incidents", async () => {
    expect((await app.request(endpoint)).status).toBe(401);
    expect(findLatest).not.toHaveBeenCalled();
    expect(findByUrls).not.toHaveBeenCalled();
  });

  it("joins first captured estimates by source URL and preserves the source timestamp", async () => {
    const response = await app.request(endpoint, { headers });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...snapshot,
      sourceUrl: "https://toplo.bg/accidents-and-maintenance",
      incidents: [{
        ...incident,
        firstObservedAt: "2026-02-06T19:01:12.027Z",
        firstReportedStart: "2025-11-04T15:00:00.000Z",
        firstEstimatedEnd: "2026-02-27T20:00:00.000Z",
      }],
    });
    expect(findByUrls).toHaveBeenCalledWith(["https://toplo.bg/incidents/one"]);
    expect(findLatest).toHaveBeenCalledWith("toplo-bg", "bg.sofia");
    expect(findLatestForDate).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=60");
  });

  it("returns a verified empty list", async () => {
    findLatest.mockResolvedValue({ ...snapshot, count: 0, incidents: [] });
    const response = await app.request(endpoint, { headers });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ count: 0, incidents: [] });
  });

  it.each([null, { ...snapshot, incidents: undefined }])(
    "distinguishes missing incident details from an empty listing",
    async (stored) => {
      findLatest.mockResolvedValue(stored);
      const response = await app.request(endpoint, { headers });
      expect(response.status).toBe(503);
      expect(findByUrls).not.toHaveBeenCalled();
    },
  );

  it("keeps incidents with no historical baseline and excludes other localities", async () => {
    findByUrls.mockResolvedValue([{ ...firstSource, locality: "bg.plovdiv" }]);
    const response = await app.request(endpoint, { headers });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      incidents: [{ ...incident, firstObservedAt: null, firstReportedStart: null, firstEstimatedEnd: null }],
    });
  });

  it("treats the legacy missing-estimate fallback as unavailable", async () => {
    findByUrls.mockResolvedValue([{
      ...firstSource,
      timespanEnd: firstSource.timespanStart,
    }]);
    const response = await app.request(endpoint, { headers });
    expect(await response.json()).toMatchObject({ incidents: [{ firstEstimatedEnd: null }] });
  });

  it("uses the earliest valid capture if historical IDs contain duplicates", async () => {
    findByUrls.mockResolvedValue([
      { ...firstSource, crawledAt: "invalid", timespanEnd: "2026-10-01T00:00:00Z" },
      { ...firstSource, crawledAt: "2026-05-01T00:00:00Z", timespanEnd: "2026-05-02T00:00:00Z" },
      firstSource,
    ]);
    const response = await app.request(endpoint, { headers });
    expect(await response.json()).toMatchObject({ incidents: [{ firstEstimatedEnd: "2026-02-27T20:00:00.000Z" }] });
  });

  it.each([
    { ...snapshot, count: 2 },
    { ...snapshot, count: 2, incidents: [incident, incident] },
    { ...snapshot, incidents: [{ ...incident, estimatedEnd: "invalid" }] },
  ])("fails rather than returning malformed or incomplete listings", async (stored) => {
    findLatest.mockResolvedValue(stored);
    expect((await app.request(endpoint, { headers })).status).toBe(500);
  });

  it("rejects unsupported sources and localities", async () => {
    expect((await app.request("/v1/sources/sofia-bg/incidents", { headers })).status).toBe(404);
    vi.stubEnv("LOCALITY", "bg.plovdiv");
    expect((await app.request(endpoint, { headers })).status).toBe(404);
    expect(findLatest).not.toHaveBeenCalled();
  });

  it("requires a configured locality", async () => {
    vi.stubEnv("LOCALITY", "");
    expect((await app.request(endpoint, { headers })).status).toBe(500);
    expect(findLatest).not.toHaveBeenCalled();
  });

  it("applies the normal rate limit", async () => {
    vi.stubEnv("PUBLIC_API_RATE_LIMIT_PER_MINUTE", "1");
    rateLimitCount.mockResolvedValue(2);
    expect((await app.request(endpoint, { headers })).status).toBe(429);
    expect(findLatest).not.toHaveBeenCalled();
  });

  it("fails on baseline storage errors", async () => {
    findByUrls.mockRejectedValue(new Error("Storage unavailable"));
    expect((await app.request(endpoint, { headers })).status).toBe(500);
  });

  it("documents authenticated access and unavailable legacy snapshots", async () => {
    const response = await app.request("/v1/openapi");
    const document = await response.json() as OpenAPIObject;
    expect(document.paths?.["/v1/sources/{sourceId}/incidents"]?.get).toMatchObject({
      security: [{ ApiKeyAuth: [] }],
      responses: { "200": expect.any(Object), "503": expect.any(Object) },
    });
  });
});

describe("dated source incident listing", () => {
  const datedEndpoint = `${endpoint}?date=2026-11-12`;

  it.each([
    "", "2026-2-01", "2026-02-1", "2026-02-29", "2024-02-30",
    "1900-02-29", "2026-04-31", "2026-00-10", "2026-13-01",
    "2026-01-00", "2026-01-32", "0000-01-01", "-0001-01-01",
    "10000-01-01", "2026-11-14", "2027-01-01", "no-date",
    "2026-11-12T00:00:00Z", " 2026-11-12", "2026-11-12 ",
  ])("rejects invalid or unsupported dates: %s", async (date) => {
    const response = await app.request(`${endpoint}?date=${encodeURIComponent(date)}`, { headers });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "date must be a single valid calendar date in YYYY-MM-DD format between 0001-01-01 and today in Europe/Sofia",
    });
    expect(findLatestForDate).not.toHaveBeenCalled();
    expect(findLatest).not.toHaveBeenCalled();
    expect(findByUrls).not.toHaveBeenCalled();
  });

  it.each(["0001-01-01", "0099-12-31", "2000-02-29", "2024-02-29", "2026-11-13"])(
    "accepts real dates within the supported bounds: %s",
    async (date) => {
      findLatestForDate.mockResolvedValue(null);
      const response = await app.request(`${endpoint}?date=${date}`, { headers });

      expect(response.status).toBe(503);
      expect(findLatestForDate).toHaveBeenCalledWith("toplo-bg", "bg.sofia", date);
      expect(findLatest).not.toHaveBeenCalled();
    },
  );

  it.each(["2026-11-12", "2026-11-13"])("rejects repeated date parameters ending with %s", async (date) => {
    const response = await app.request(`${datedEndpoint}&date=${date}`, { headers });

    expect(response.status).toBe(400);
    expect(findLatestForDate).not.toHaveBeenCalled();
    expect(findLatest).not.toHaveBeenCalled();
  });

  it.each([
    ["2026-11-12T21:59:59Z", "2026-11-13", 400],
    ["2026-11-12T22:00:00Z", "2026-11-13", 200],
    ["2026-03-28T21:59:59Z", "2026-03-29", 400],
    ["2026-03-28T22:00:00Z", "2026-03-29", 200],
    ["2026-03-29T20:59:59Z", "2026-03-30", 400],
    ["2026-03-29T21:00:00Z", "2026-03-30", 200],
    ["2026-10-24T20:59:59Z", "2026-10-25", 400],
    ["2026-10-24T21:00:00Z", "2026-10-25", 200],
    ["2026-10-25T21:59:59Z", "2026-10-26", 400],
    ["2026-10-25T22:00:00Z", "2026-10-26", 200],
  ])("uses the Sofia date at %s for a request for %s", async (now, date, status) => {
    vi.setSystemTime(new Date(now));
    findLatestForDate.mockResolvedValue({
      ...snapshot,
      observedAt: now,
      count: 0,
      incidents: [],
    });
    const response = await app.request(`${endpoint}?date=${date}`, { headers });

    expect(response.status).toBe(status);
    if (status === 400) {
      expect(findLatestForDate).not.toHaveBeenCalled();
    } else {
      expect(findLatestForDate).toHaveBeenCalledWith("toplo-bg", "bg.sofia", date);
    }
  });

  it("returns recorded fields and the actual observation separately from first-record baselines", async () => {
    const historicalIncident = {
      ...incident,
      accidentId: "earlier-listing-id",
      name: "Предишно име",
      addresses: "ул. Оборище 106 и бл. 18",
      type: "repair",
      reportedStart: "2026-10-01T10:00:00Z",
      estimatedEnd: null,
    };
    const historical = {
      ...snapshot,
      observedAt: "2026-11-11T22:10:00.000Z",
      incidents: [historicalIncident],
    };
    findLatestForDate.mockResolvedValue(historical);
    const response = await app.request(datedEndpoint, { headers });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...historical,
      sourceUrl: "https://toplo.bg/accidents-and-maintenance",
      incidents: [{
        ...historicalIncident,
        firstObservedAt: "2026-02-06T19:01:12.027Z",
        firstReportedStart: "2025-11-04T15:00:00.000Z",
        firstEstimatedEnd: "2026-02-27T20:00:00.000Z",
      }],
    });
    expect(findLatestForDate).toHaveBeenCalledWith("toplo-bg", "bg.sofia", "2026-11-12");
    expect(findLatest).not.toHaveBeenCalled();
    expect(findByUrls).toHaveBeenCalledWith(["https://toplo.bg/incidents/one"]);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=60");
  });

  it("orders both types by start, Bulgarian name and stable ID, with missing starts last", async () => {
    const entries = [
      { ...incident, id: "unknown-b", accidentId: "u-b", name: "Б", reportedStart: null },
      { ...incident, id: "tied-b", accidentId: "t-b", name: "А" },
      { ...incident, id: "name-b", accidentId: "n-b", name: "Б" },
      { ...incident, id: "older", accidentId: "o", name: "Я", type: "repair", reportedStart: "2025-01-01T00:00:00Z" },
      { ...incident, id: "unknown-a", accidentId: "u-a", name: "А", type: "repair", reportedStart: null },
      { ...incident, id: "name-v", accidentId: "n-v", name: "В" },
      { ...incident, id: "tied-a", accidentId: "t-a", name: "А", type: "repair", reportedStart: "2025-11-04T15:00:00.000Z" },
    ];
    const originalIds = entries.map((item) => {
      return item.id;
    });
    const capture = { ...snapshot, count: entries.length, incidents: entries };
    findLatestForDate.mockResolvedValue(capture);
    findByUrls.mockResolvedValue([]);
    const response = await app.request(datedEndpoint, { headers });
    const body = await response.json() as SourceIncidentsResponse;

    expect(response.status).toBe(200);
    expect(body.count).toBe(entries.length);
    expect(body.incidents.map((item: { id: string }) => {
      return item.id;
    })).toEqual(["older", "tied-a", "tied-b", "name-b", "name-v", "unknown-a", "unknown-b"]);
    expect(capture.incidents.map((item) => {
      return item.id;
    })).toEqual(originalIds);

    findLatest.mockResolvedValue(capture);
    const latest = await app.request(endpoint, { headers });
    const latestBody = await latest.json() as SourceIncidentsResponse;
    expect(latestBody.incidents.map((item: { id: string }) => {
      return item.id;
    })).toEqual(originalIds);
  });

  it.each([null, { ...snapshot, incidents: undefined }, { ...snapshot, count: 0, incidents: undefined }])(
    "keeps unavailable and legacy count-only days as gaps",
    async (stored) => {
      findLatestForDate.mockResolvedValue(stored);
      const response = await app.request(datedEndpoint, { headers });

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: "No complete incident listing is available for the requested date",
      });
      expect(findLatest).not.toHaveBeenCalled();
      expect(findByUrls).not.toHaveBeenCalled();
    },
  );

  it("returns the original timestamp for a verified empty detailed day", async () => {
    const empty = { ...snapshot, count: 0, incidents: [], observedAt: "2026-11-12T20:30:00.000Z" };
    findLatestForDate.mockResolvedValue(empty);
    const response = await app.request(datedEndpoint, { headers });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...empty,
      sourceUrl: "https://toplo.bg/accidents-and-maintenance",
    });
    expect(findLatest).not.toHaveBeenCalled();
  });

  it("lets today's selected observation change as new successful captures arrive", async () => {
    const earlier = { ...snapshot, observedAt: "2026-11-13T08:00:00.000Z" };
    const later = {
      ...snapshot,
      observedAt: "2026-11-13T08:30:00.000Z",
      count: 0,
      incidents: [],
    };
    findLatestForDate.mockResolvedValueOnce(earlier).mockResolvedValueOnce(later);
    const first = await app.request(`${endpoint}?date=2026-11-13`, { headers });
    const second = await app.request(`${endpoint}?date=2026-11-13`, { headers });

    expect(await first.json()).toMatchObject(earlier);
    expect(await second.json()).toMatchObject(later);
  });

  it.each([undefined, { "X-Api-Key": "invalid-history-key" }])("requires valid authentication for historical reads", async (authHeaders) => {
    const response = await app.request(datedEndpoint, { headers: authHeaders });

    expect(response.status).toBe(401);
    expect(findLatestForDate).not.toHaveBeenCalled();
    expect(findByUrls).not.toHaveBeenCalled();
  });

  it("applies rate limits to historical reads", async () => {
    vi.stubEnv("PUBLIC_API_RATE_LIMIT_PER_MINUTE", "1");
    rateLimitCount.mockResolvedValue(2);
    const response = await app.request(datedEndpoint, { headers });

    expect(response.status).toBe(429);
    expect(findLatestForDate).not.toHaveBeenCalled();
  });

  it.each([
    { ...snapshot, count: 2 },
    { ...snapshot, count: 0 },
    { ...snapshot, count: 2, incidents: [incident, incident] },
    { ...snapshot, incidents: [{ ...incident, reportedStart: "invalid" }] },
  ])("reports malformed detailed history as an error", async (stored) => {
    findLatestForDate.mockResolvedValue(stored);
    expect((await app.request(datedEndpoint, { headers })).status).toBe(500);
    expect(findLatest).not.toHaveBeenCalled();
  });

  it("reports capture storage failures as errors", async () => {
    findLatestForDate.mockRejectedValue(new Error("Storage unavailable"));
    const response = await app.request(datedEndpoint, { headers });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to fetch source incidents" });
    expect(findLatest).not.toHaveBeenCalled();
  });

  it("reports baseline storage failures as errors", async () => {
    findByUrls.mockRejectedValue(new Error("Storage unavailable"));
    expect((await app.request(datedEndpoint, { headers })).status).toBe(500);
  });
});
