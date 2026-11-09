import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceSnapshot } from "@oboapp/shared";
import app from "../index";
import { getDb } from "../lib/db";
import { SourceIncidentChangesResponseSchema, type SourceIncidentChangesResponse } from "../schema/response";

vi.mock("../lib/db", () => ({ getDb: vi.fn() }));

const endpoint = "/v1/sources/toplo-bg/incident-changes";
const headers = { "X-Api-Key": "changes-test" };
const findLatest = vi.fn();
const findLatestForDate = vi.fn();
const findRange = vi.fn();
const incrementAndGetCount = vi.fn();
let baseline: SourceSnapshot | null;
let end: SourceSnapshot | null;

function capture(observedAt: string, ids: string[]): SourceSnapshot {
  return {
    sourceType: "toplo-bg",
    locality: "bg.sofia",
    observedAt,
    count: ids.length,
    incidents: ids.map((id) => {
      return {
        id,
        accidentId: `accident-${id}`,
        name: id,
        addresses: "",
        type: "accident",
        status: 1,
        reportedStart: null,
        estimatedEnd: null,
        createdAt: null,
      };
    }),
  };
}

async function request(query = ""): Promise<SourceIncidentChangesResponse> {
  const response = await app.request(`${endpoint}${query}`, { headers });
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, max-age=60");
  return SourceIncidentChangesResponseSchema.parse(await response.json());
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
  vi.stubEnv("PUBLIC_API_KEYS", "changes-test");
  vi.stubEnv("LOCALITY", "bg.sofia");
  vi.stubEnv("PUBLIC_API_RATE_LIMIT_PER_MINUTE", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  baseline = capture("2026-11-14T20:30:00.000Z", ["one"]);
  end = capture("2026-11-15T11:30:00.000Z", ["one"]);
  findLatestForDate.mockImplementation((_source, _locality, date) => {
    return Promise.resolve(date === "2026-11-14" ? baseline : end);
  });
  findLatest.mockImplementation(() => {
    return Promise.resolve(end);
  });
  findRange.mockImplementation(() => {
    return Promise.resolve({ snapshots: end ? [end] : [], truncated: false });
  });
  incrementAndGetCount.mockResolvedValue(1);
  vi.mocked(getDb).mockResolvedValue({
    sourceSnapshots: { findLatest, findLatestForDate, findRange },
    apiUsageHourly: { increment: vi.fn().mockResolvedValue(undefined) },
    apiRateLimitsMinute: { incrementAndGetCount },
    apiClients: { findByApiKey: vi.fn().mockResolvedValue(null) },
  } as unknown as Awaited<ReturnType<typeof getDb>>);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("source incident transition counts", () => {
  it("requires the normal API key before reading captures", async () => {
    expect((await app.request(endpoint)).status).toBe(401);
    expect(findLatestForDate).not.toHaveBeenCalled();
    expect(findRange).not.toHaveBeenCalled();
  });

  it("counts ten additions and five removals for a net increase of five", async () => {
    const original = Array.from({ length: 20 }, (_, index) => `original-${index}`);
    const added = Array.from({ length: 10 }, (_, index) => `new-${index}`);
    baseline = capture("2026-11-14T20:30:00.000Z", original);
    end = capture("2026-11-15T11:30:00.000Z", [...original.slice(5), ...added]);
    const result = await request();
    expect(result).toMatchObject({
      sourceType: "toplo-bg",
      locality: "bg.sofia",
      date: "2026-11-15",
      baselineDate: "2026-11-14",
      baseline: { count: 20, observedAt: baseline.observedAt },
      end: { count: 25, observedAt: end.observedAt },
      totals: { added: 10, removed: 5 },
      netChange: 5,
      coverage: { status: "observed", reasons: [], stale: false },
    });
    expect(findRange).toHaveBeenCalledWith("toplo-bg", "bg.sofia", baseline.observedAt, end.observedAt);
    expect(result.baseline).not.toHaveProperty("incidents");
  });

  it("includes temporary appearances and reappearances between the same endpoints", async () => {
    const temporary = capture("2026-11-15T05:00:00.000Z", ["one", "temporary"]);
    const removed = capture("2026-11-15T05:30:00.000Z", []);
    findRange.mockResolvedValue({ snapshots: [temporary, removed, end], truncated: false });
    const result = await request();
    expect(result.totals).toEqual({ added: 2, removed: 2 });
    expect(result.netChange).toBe(0);
    expect(result.coverage.detailedCaptureCount).toBe(4);
  });

  it("ignores accidentId and other field revisions for the same stable ID", async () => {
    end = {
      ...end!,
      incidents: [{ ...end!.incidents![0], accidentId: "revised", name: "New name", status: 2 }],
    };
    expect((await request()).totals).toEqual({ added: 0, removed: 0 });
  });

  it("compares verified empty captures, including empty baselines", async () => {
    end = capture("2026-11-15T11:30:00.000Z", []);
    expect((await request()).totals).toEqual({ added: 0, removed: 1 });
    baseline = capture("2026-11-14T20:30:00.000Z", []);
    expect((await request()).totals).toEqual({ added: 0, removed: 0 });
    end = capture("2026-11-15T11:30:00.000Z", ["two"]);
    expect((await request()).totals).toEqual({ added: 1, removed: 0 });
  });

  it("bridges gaps between complete captures and reports elapsed time and unknown continuity", async () => {
    const result = await request();
    expect(result.coverage).toMatchObject({
      status: "observed",
      retainedCaptureCount: 2,
      gapThresholdMinutes: 45,
      gaps: [{
        fromObservedAt: baseline!.observedAt,
        toObservedAt: end!.observedAt,
        minutes: 900,
      }],
      failedChecks: "not_recorded",
      continuity: "unknown",
    });
    expect(result.totals).toEqual({ added: 0, removed: 0 });
  });

  it("does not mark normal half-hour intervals as gaps", async () => {
    baseline = capture("2026-11-14T21:30:00.000Z", ["one"]);
    end = capture("2026-11-14T22:00:00.000Z", ["two"]);
    expect((await request()).coverage.gaps).toEqual([]);
  });

  it("reports a full hour between captures as a gap after a missed half-hour check", async () => {
    baseline = capture("2026-11-14T21:30:00.000Z", ["one"]);
    end = capture("2026-11-14T22:30:00.000Z", ["one"]);
    expect((await request()).coverage.gaps).toEqual([{
      fromObservedAt: baseline.observedAt,
      toObservedAt: end.observedAt,
      minutes: 60,
    }]);
  });

  it("leaves a missing baseline unavailable without substituting an earlier date", async () => {
    baseline = null;
    const result = await request();
    expect(result).toMatchObject({ baseline: null, totals: null, netChange: null });
    expect(result.coverage.reasons).toContain("missing_baseline");
    expect(findRange).not.toHaveBeenCalled();
    expect(findLatestForDate).toHaveBeenCalledWith("toplo-bg", "bg.sofia", "2026-11-14");
  });

  it("does not turn a missing current observation into zero transitions", async () => {
    const latest = baseline;
    end = null;
    findLatest.mockResolvedValue(latest);
    const result = await request();
    expect(result).toMatchObject({ end: null, totals: null, netChange: null });
    expect(result.coverage).toMatchObject({
      reasons: ["missing_end"], stale: true, latestObservedAt: latest!.observedAt,
    });
  });

  it("keeps entirely unknown coverage explicit", async () => {
    baseline = null;
    end = null;
    const result = await request();
    expect(result).toMatchObject({ baseline: null, end: null, totals: null, netChange: null });
    expect(result.coverage).toMatchObject({
      status: "unavailable",
      reasons: ["missing_baseline", "missing_end"],
      latestObservedAt: null,
      stale: null,
      retainedCaptureCount: 0,
    });
  });

  it.each(["baseline", "end", "intermediate"])("leaves legacy %s counts unavailable", async (position) => {
    if (position === "baseline") {
      baseline = { ...baseline!, incidents: undefined };
    } else if (position === "end") {
      end = { ...end!, incidents: undefined };
    } else {
      findRange.mockResolvedValue({
        snapshots: [{ ...end!, observedAt: "2026-11-15T05:00:00.000Z", incidents: undefined }, end],
        truncated: false,
      });
    }
    const result = await request();
    expect(result.totals).toBeNull();
    expect(result.netChange).toBe(0);
    expect(result.coverage.reasons).toContain("missing_incident_details");
  });

  it("refuses totals when the bounded history exceeds the capture limit", async () => {
    findRange.mockResolvedValue({ snapshots: [end], truncated: true });
    const result = await request();
    expect(result.totals).toBeNull();
    expect(result.coverage.reasons).toContain("capture_limit_exceeded");
  });

  it("refuses totals if the selected end is missing from the history read", async () => {
    findRange.mockResolvedValue({ snapshots: [], truncated: false });
    const result = await request();
    expect(result.totals).toBeNull();
    expect(result.coverage.reasons).toContain("missing_history");
  });

  it("refuses totals if the end count changed between the endpoint and history reads", async () => {
    findRange.mockResolvedValue({ snapshots: [capture(end!.observedAt, ["one", "two"])], truncated: false });
    const result = await request();
    expect(result.totals).toBeNull();
    expect(result.coverage.reasons).toContain("missing_history");
  });

  it("reports stale observations without changing the original timestamps or totals", async () => {
    vi.setSystemTime(new Date("2026-11-15T14:00:00Z"));
    const result = await request();
    expect(result.end?.observedAt).toBe(end!.observedAt);
    expect(result.coverage).toMatchObject({ stale: true, staleAfterMinutes: 60 });
    expect(result.totals).toEqual({ added: 0, removed: 0 });
  });

  it("uses the Sofia date at UTC midnight and supports historical day boundaries", async () => {
    vi.setSystemTime(new Date("2026-11-14T22:15:00Z"));
    expect((await request()).date).toBe("2026-11-15");
    const result = await request("?date=2026-03-29");
    expect(result).toMatchObject({ date: "2026-03-29", baselineDate: "2026-03-28" });
    expect(result.coverage.stale).toBeNull();
    expect(findLatestForDate).toHaveBeenCalledWith("toplo-bg", "bg.sofia", "2026-03-28");
    expect(findLatestForDate).toHaveBeenCalledWith("toplo-bg", "bg.sofia", "2026-03-29");
  });

  it.each(["2026-02-30", "2026-11-16", "0000-01-01", "0001-01-01", "", "2026-11-15T12:00:00Z"])(
    "rejects unsupported date %s",
    async (date) => {
      expect((await app.request(`${endpoint}?date=${date}`, { headers })).status).toBe(400);
      expect(findRange).not.toHaveBeenCalled();
    },
  );

  it("rejects repeated dates", async () => {
    expect((await app.request(`${endpoint}?date=2026-11-14&date=2026-11-15`, { headers })).status).toBe(400);
  });

  it("supports the earliest date with a representable baseline day", async () => {
    const result = await request("?date=0001-01-02");
    expect(result.baselineDate).toBe("0001-01-01");
    expect(findLatestForDate).toHaveBeenCalledWith("toplo-bg", "bg.sofia", "0001-01-01");
  });

  it("reports missing locality configuration", async () => {
    vi.stubEnv("LOCALITY", "");
    expect((await app.request(endpoint, { headers })).status).toBe(500);
    expect(findRange).not.toHaveBeenCalled();
  });

  it("rejects unsupported sources and localities", async () => {
    expect((await app.request("/v1/sources/sofiyska-voda/incident-changes", { headers })).status).toBe(404);
    vi.stubEnv("LOCALITY", "bg.plovdiv");
    expect((await app.request(endpoint, { headers })).status).toBe(404);
    expect(findRange).not.toHaveBeenCalled();
  });

  it("applies the shared rate limit", async () => {
    vi.stubEnv("PUBLIC_API_RATE_LIMIT_PER_MINUTE", "1");
    incrementAndGetCount.mockResolvedValue(2);
    expect((await app.request(endpoint, { headers })).status).toBe(429);
    expect(findRange).not.toHaveBeenCalled();
  });

  it("reports database failures", async () => {
    findRange.mockRejectedValue(new Error("Unavailable"));
    expect((await app.request(endpoint, { headers })).status).toBe(500);
  });
});
