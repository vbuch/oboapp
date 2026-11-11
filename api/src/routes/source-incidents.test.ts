import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenAPIObject } from "openapi3-ts/oas30";
import app from "../index";
import { getDb } from "../lib/db";

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
const findByUrls = vi.fn();
const rateLimitCount = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("PUBLIC_API_KEYS", "incidents-test");
  vi.stubEnv("LOCALITY", "bg.sofia");
  vi.stubEnv("PUBLIC_API_RATE_LIMIT_PER_MINUTE", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  findLatest.mockResolvedValue(snapshot);
  findByUrls.mockResolvedValue([firstSource]);
  rateLimitCount.mockResolvedValue(1);
  vi.mocked(getDb).mockResolvedValue({
    sourceSnapshots: { findLatest },
    sources: { findByUrls },
    apiUsageHourly: { increment: vi.fn().mockResolvedValue(undefined) },
    apiRateLimitsMinute: { incrementAndGetCount: rateLimitCount },
    apiClients: { findByApiKey: vi.fn().mockResolvedValue(null) },
  } as unknown as Awaited<ReturnType<typeof getDb>>);
});

afterEach(() => {
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
