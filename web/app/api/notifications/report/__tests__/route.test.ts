import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { hasReportPagesEnabled } from "@/lib/report-pages";

const { findManyMatchesMock, findManyMessagesMock } = vi.hoisted(() => ({
  findManyMatchesMock: vi.fn(),
  findManyMessagesMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn().mockResolvedValue({
    notificationMatches: {
      findMany: findManyMatchesMock,
    },
    messages: {
      findMany: findManyMessagesMock,
    },
  }),
}));

vi.mock("@/lib/report-pages", () => ({
  hasReportPagesEnabled: vi.fn().mockReturnValue(true),
}));

function makeRequest(mode?: string) {
  const url = mode
    ? `http://localhost/api/notifications/report?mode=${mode}`
    : "http://localhost/api/notifications/report";
  return new Request(url);
}

function makeMatch(overrides: Record<string, unknown> = {}) {
  return {
    _id: "m1",
    userId: "u1",
    messageId: "msg1",
    notified: true,
    clickedAt: null,
    openedAt: null,
    messageSnapshot: { source: "src-a" },
    ...overrides,
  };
}

function makeMessage(id: string, coords?: [number, number]) {
  return {
    _id: id,
    cityWide: false,
    geoJson: coords
      ? {
          features: [
            { geometry: { type: "Point", coordinates: [coords[1], coords[0]] } },
          ],
        }
      : { features: [] },
  };
}

describe("GET /api/notifications/report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasReportPagesEnabled).mockReturnValue(true);
    findManyMatchesMock.mockResolvedValue([]);
    findManyMessagesMock.mockResolvedValue([]);
  });

  it("returns 503 when report pages are not enabled", async () => {
    vi.mocked(hasReportPagesEnabled).mockReturnValue(false);

    const response = await GET(makeRequest() as any);
    expect(response.status).toBe(503);
  });

  it("returns empty KPIs for no matches", async () => {
    const response = await GET(makeRequest() as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sent).toBe(0);
    expect(data.uniqueUsers).toBe(0);
    expect(data.clicked).toBe(0);
    expect(data.opened).toBe(0);
    expect(data.sources).toEqual([]);
  });

  it("returns correct KPIs", async () => {
    findManyMatchesMock.mockResolvedValue([
      makeMatch({ userId: "u1", clickedAt: "2026-01-01", openedAt: "2026-01-01" }),
      makeMatch({ userId: "u2", clickedAt: null, openedAt: null, messageId: "msg2" }),
    ]);
    findManyMessagesMock.mockResolvedValue([
      makeMessage("msg1", [42.7, 23.3]),
      makeMessage("msg2", [42.8, 23.4]),
    ]);

    const response = await GET(makeRequest() as any);
    const data = await response.json();

    expect(data.sent).toBe(2);
    expect(data.uniqueUsers).toBe(2);
    expect(data.clicked).toBe(1);
    expect(data.opened).toBe(1);
  });

  it("hides heatmap for privacy when fewer than 50 records in mode", async () => {
    // 1 match in "all" mode — below threshold of 50
    findManyMatchesMock.mockResolvedValue([
      makeMatch({ messageId: "msg1" }),
    ]);
    findManyMessagesMock.mockResolvedValue([makeMessage("msg1", [42.7, 23.3])]);

    const response = await GET(makeRequest("all") as any);
    const data = await response.json();

    expect(data.heatmapHiddenForPrivacy).toBe(true);
    expect(data.heatmapPoints).toEqual([]);
  });

  it("returns heatmap points when >= 50 records in mode", async () => {
    const matches = Array.from({ length: 50 }, (_, i) => makeMatch({ messageId: `msg${i}` }));
    findManyMatchesMock.mockResolvedValue(matches);
    findManyMessagesMock.mockResolvedValue(
      matches.map((m) => makeMessage(String(m.messageId), [42.7 + Number(String(m.messageId).replace("msg", "")) * 0.001, 23.3])),
    );

    const response = await GET(makeRequest("all") as any);
    const data = await response.json();

    expect(data.heatmapHiddenForPrivacy).toBe(false);
    expect(data.heatmapPoints.length).toBe(50);
  });

  it('filters heatmap to only clicked matches when mode="clicked"', async () => {
    findManyMatchesMock.mockResolvedValue([
      makeMatch({ messageId: "msg1", clickedAt: "2026-01-01" }),
      makeMatch({ messageId: "msg2", clickedAt: null }),
    ]);
    findManyMessagesMock.mockResolvedValue([makeMessage("msg1", [42.7, 23.3])]);

    const response = await GET(makeRequest("clicked") as any);
    const data = await response.json();

    // Only 1 clicked — below threshold, heatmap hidden
    expect(data.heatmapHiddenForPrivacy).toBe(true);
  });

  it('filters heatmap to only opened matches when mode="opened"', async () => {
    findManyMatchesMock.mockResolvedValue([
      makeMatch({ messageId: "msg1", openedAt: "2026-01-01" }),
      makeMatch({ messageId: "msg2", openedAt: null }),
    ]);
    findManyMessagesMock.mockResolvedValue([makeMessage("msg1", [42.7, 23.3])]);

    const response = await GET(makeRequest("opened") as any);
    const data = await response.json();

    // Only 1 opened — below threshold, heatmap hidden
    expect(data.heatmapHiddenForPrivacy).toBe(true);
  });

  it("defaults to mode=all for unknown mode values", async () => {
    findManyMatchesMock.mockResolvedValue([makeMatch()]);
    findManyMessagesMock.mockResolvedValue([makeMessage("msg1", [42.7, 23.3])]);

    // Should not throw; unknown mode falls back to "all"
    const response = await GET(makeRequest("invalid") as any);
    expect(response.status).toBe(200);
  });

  it("returns source breakdown", async () => {
    findManyMatchesMock.mockResolvedValue([
      makeMatch({ messageSnapshot: { source: "src-a" }, clickedAt: "2026-01-01" }),
      makeMatch({ messageSnapshot: { source: "src-a" }, messageId: "msg2" }),
      makeMatch({ messageSnapshot: { source: "src-b" }, messageId: "msg3" }),
    ]);
    findManyMessagesMock.mockResolvedValue([]);

    const response = await GET(makeRequest() as any);
    const data = await response.json();

    expect(data.sources[0]).toEqual({ source: "src-a", sent: 2, clicked: 1 });
    expect(data.sources[1]).toEqual({ source: "src-b", sent: 1, clicked: 0 });
  });

  it("returns 500 on database error", async () => {
    findManyMatchesMock.mockRejectedValue(new Error("DB error"));

    const response = await GET(makeRequest() as any);
    expect(response.status).toBe(500);
  });
});
