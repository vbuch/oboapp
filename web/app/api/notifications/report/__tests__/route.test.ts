import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../route";
import { hasReportPagesEnabled } from "@/lib/report-pages";

// GCS mock — mirrors the pattern used by app/api/messages/heatmap/route.test.ts
const mockDownload = vi.fn();
const mockExists = vi.fn();
const mockFile = vi.fn();
const mockBucket = vi.fn();

vi.mock("@google-cloud/storage", () => ({
  Storage: vi.fn().mockImplementation(function () {
    return { bucket: mockBucket };
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

function makeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: "2026-07-10T03:00:00.000Z",
    trackedSince: null,
    kpis: { sent: 0, uniqueUsers: 0, clicked: 0, opened: 0 },
    sources: [],
    heatmap: {
      all: { points: [], hiddenForPrivacy: true },
      clicked: { points: [], hiddenForPrivacy: true },
      opened: { points: [], hiddenForPrivacy: true },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(hasReportPagesEnabled).mockReturnValue(true);

  mockDownload.mockResolvedValue([
    Buffer.from(JSON.stringify(makeSnapshot())),
  ]);
  mockExists.mockResolvedValue([true]);
  mockFile.mockReturnValue({ exists: mockExists, download: mockDownload });
  mockBucket.mockReturnValue({ file: mockFile });

  process.env.GCS_GENERIC_BUCKET = "test-bucket";
});

afterEach(() => {
  delete process.env.GCS_GENERIC_BUCKET;
});

describe("GET /api/notifications/report", () => {
  it("returns 503 when report pages are not enabled", async () => {
    vi.mocked(hasReportPagesEnabled).mockReturnValue(false);
    const response = await GET(makeRequest() as any);
    expect(response.status).toBe(503);
  });

  it("returns 503 when GCS bucket is not configured", async () => {
    delete process.env.GCS_GENERIC_BUCKET;
    const response = await GET(makeRequest() as any);
    expect(response.status).toBe(503);
  });

  it("returns 503 when snapshot does not exist yet", async () => {
    mockExists.mockResolvedValue([false]);
    const response = await GET(makeRequest() as any);
    expect(response.status).toBe(503);
  });

  it("returns KPIs from snapshot", async () => {
    mockDownload.mockResolvedValue([
      Buffer.from(
        JSON.stringify(
          makeSnapshot({
            kpis: { sent: 25, uniqueUsers: 10, clicked: 5, opened: 3 },
          }),
        ),
      ),
    ]);

    const response = await GET(makeRequest() as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sent).toBe(25);
    expect(data.uniqueUsers).toBe(10);
    expect(data.clicked).toBe(5);
    expect(data.opened).toBe(3);
  });

  it("returns mode=all heatmap by default", async () => {
    const points: [number, number][] = [[42.7, 23.3]];
    mockDownload.mockResolvedValue([
      Buffer.from(
        JSON.stringify(
          makeSnapshot({
            heatmap: {
              all: { points, hiddenForPrivacy: false },
              clicked: { points: [], hiddenForPrivacy: true },
              opened: { points: [], hiddenForPrivacy: true },
            },
          }),
        ),
      ),
    ]);

    const response = await GET(makeRequest() as any);
    const data = await response.json();

    expect(data.heatmapPoints).toEqual(points);
    expect(data.heatmapHiddenForPrivacy).toBe(false);
  });

  it('returns mode=clicked heatmap when mode="clicked"', async () => {
    const clickedPoints: [number, number][] = [[42.8, 23.4]];
    mockDownload.mockResolvedValue([
      Buffer.from(
        JSON.stringify(
          makeSnapshot({
            heatmap: {
              all: { points: [[42.7, 23.3]], hiddenForPrivacy: false },
              clicked: { points: clickedPoints, hiddenForPrivacy: false },
              opened: { points: [], hiddenForPrivacy: true },
            },
          }),
        ),
      ),
    ]);

    const response = await GET(makeRequest("clicked") as any);
    const data = await response.json();

    expect(data.heatmapPoints).toEqual(clickedPoints);
    expect(data.heatmapHiddenForPrivacy).toBe(false);
  });

  it('returns hidden heatmap for mode=opened when below threshold', async () => {
    const response = await GET(makeRequest("opened") as any);
    const data = await response.json();

    expect(data.heatmapHiddenForPrivacy).toBe(true);
  });

  it("defaults to mode=all for unknown mode values", async () => {
    const response = await GET(makeRequest("invalid") as any);
    expect(response.status).toBe(200);
  });

  it("returns source breakdown from snapshot", async () => {
    mockDownload.mockResolvedValue([
      Buffer.from(
        JSON.stringify(
          makeSnapshot({
            sources: [
              { source: "src-a", sent: 2, clicked: 1 },
              { source: "src-b", sent: 1, clicked: 0 },
            ],
          }),
        ),
      ),
    ]);

    const response = await GET(makeRequest() as any);
    const data = await response.json();

    expect(data.sources[0]).toEqual({ source: "src-a", sent: 2, clicked: 1 });
    expect(data.sources[1]).toEqual({ source: "src-b", sent: 1, clicked: 0 });
  });

  it("includes generatedAt and trackedSince in response", async () => {
    mockDownload.mockResolvedValue([
      Buffer.from(
        JSON.stringify(
          makeSnapshot({ trackedSince: "2026-07-10T08:00:00.000Z" }),
        ),
      ),
    ]);

    const response = await GET(makeRequest() as any);
    const data = await response.json();

    expect(data.generatedAt).toBe("2026-07-10T03:00:00.000Z");
    expect(data.trackedSince).toBe("2026-07-10T08:00:00.000Z");
  });

  it("returns 500 when GCS download fails", async () => {
    mockDownload.mockRejectedValue(new Error("GCS error"));

    const response = await GET(makeRequest() as any);
    expect(response.status).toBe(500);
  });
});
