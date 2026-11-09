import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../index";
import { getDb } from "../lib/db";
import { SourceTimelineResponseSchema } from "../schema/response";

vi.mock("../lib/db", () => ({ getDb: vi.fn() }));
const findLatest = vi.fn();
const findRange = vi.fn();
const findByDate = vi.fn();
const headers = { "X-Api-Key": "timeline-test" };
const endpoint = "/v1/sources/toplo-bg/timeline";
const current = {
  sourceType: "toplo-bg",
  locality: "bg.sofia",
  count: 99,
  observedAt: "2026-11-09T20:30:00.000Z",
};
const previous = {
  sourceType: "toplo-bg",
  locality: "bg.sofia",
  date: "2026-11-08",
  count: 103,
  observedAt: "2026-11-08T20:30:00.000Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-09T21:00:00Z"));
  vi.stubEnv("PUBLIC_API_KEYS", "timeline-test");
  vi.stubEnv("LOCALITY", "bg.sofia");
  vi.stubEnv("PUBLIC_API_RATE_LIMIT_PER_MINUTE", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  findLatest.mockResolvedValue(current);
  findRange.mockResolvedValue([previous]);
  findByDate.mockResolvedValue(previous);
  vi.mocked(getDb).mockResolvedValue({
    sourceSnapshots: { findLatest },
    sourceDailyCounts: { findRange, findByDate },
    apiUsageHourly: { increment: vi.fn().mockResolvedValue(undefined) },
    apiClients: { findByApiKey: vi.fn().mockResolvedValue(null) },
  } as unknown as Awaited<ReturnType<typeof getDb>>);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("source timeline", () => {
  it("requires authentication", async () => {
    expect((await app.request(endpoint)).status).toBe(401);
    expect(findLatest).not.toHaveBeenCalled();
  });

  it("returns the current count, daily series and yesterday difference", async () => {
    const response = await app.request(endpoint, { headers });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      sourceType: "toplo-bg",
      locality: "bg.sofia",
      sourceUrl: "https://toplo.bg/accidents-and-maintenance",
      current: { count: 99, observedAt: current.observedAt },
      daily: [
        { date: previous.date, count: 103, observedAt: previous.observedAt },
      ],
      comparison: {
        date: previous.date,
        count: 103,
        observedAt: previous.observedAt,
        change: -4,
      },
    });
    expect(findByDate).toHaveBeenCalledWith("toplo-bg", "bg.sofia", "2026-11-08");
  });

  it("returns null comparison instead of guessing when yesterday is missing", async () => {
    findByDate.mockResolvedValue(null);
    const response = await app.request(endpoint, { headers });
    expect(
      SourceTimelineResponseSchema.parse(await response.json()).comparison,
    ).toBeNull();
  });

  it("keeps a valid zero current count and calculates its change", async () => {
    findLatest.mockResolvedValue({ ...current, count: 0 });
    const response = await app.request(endpoint, { headers });
    const data = SourceTimelineResponseSchema.parse(await response.json());
    expect(data.current?.count).toBe(0);
    expect(data.comparison?.change).toBe(-103);
  });

  it("keeps available history when a current snapshot is unavailable", async () => {
    findLatest.mockResolvedValue(null);
    const response = await app.request(endpoint, { headers });
    const data = SourceTimelineResponseSchema.parse(await response.json());
    expect(data.current).toBeNull();
    expect(data.daily).toHaveLength(1);
    expect(data.comparison).toBeNull();
  });

  it("uses the source observation date when the current check is stale", async () => {
    vi.setSystemTime(new Date("2026-11-10T21:00:00Z"));
    await app.request(endpoint, { headers });
    expect(findByDate).toHaveBeenCalledWith("toplo-bg", "bg.sofia", "2026-11-08");
  });

  it.each(["0", "367", "1.5", "bad", "-2"])("rejects days=%s", async (days) => {
    expect(
      (await app.request(`${endpoint}?days=${days}`, { headers })).status,
    ).toBe(400);
    expect(findRange).not.toHaveBeenCalled();
  });

  it("rejects an unknown source", async () => {
    expect(
      (await app.request("/v1/sources/unknown/timeline", { headers })).status,
    ).toBe(404);
  });

  it("returns a failure rather than a false zero", async () => {
    findLatest.mockRejectedValue(new Error("storage"));
    expect((await app.request(endpoint, { headers })).status).toBe(500);
  });
});
