import { describe, it, expect } from "vitest";
import {
  aggregateNotificationKpis,
  buildHeatmapResult,
  extractHeatmapPointsFromMessage,
  getMessageIdsForMode,
  HEATMAP_PRIVACY_THRESHOLD,
} from "../aggregation";

describe("aggregateNotificationKpis", () => {
  it("returns zero totals for empty input", () => {
    const result = aggregateNotificationKpis([]);
    expect(result).toEqual({
      sent: 0,
      uniqueUsers: 0,
      clicked: 0,
      opened: 0,
      sources: [],
    });
  });

  it("counts sent, unique users, clicked, opened correctly", () => {
    const matches = [
      { userId: "u1", messageId: "m1", clickedAt: "2026-01-01", openedAt: undefined, messageSnapshot: { source: "src-a" } },
      { userId: "u2", messageId: "m2", clickedAt: undefined, openedAt: "2026-01-01", messageSnapshot: { source: "src-a" } },
      { userId: "u1", messageId: "m3", clickedAt: undefined, openedAt: undefined, messageSnapshot: { source: "src-b" } },
    ];

    const result = aggregateNotificationKpis(matches);

    expect(result.sent).toBe(3);
    expect(result.uniqueUsers).toBe(2);
    expect(result.clicked).toBe(1);
    expect(result.opened).toBe(1);
  });

  it("groups sources and sorts by sent count descending", () => {
    const matches = [
      { userId: "u1", messageId: "m1", messageSnapshot: { source: "src-b" } },
      { userId: "u2", messageId: "m2", messageSnapshot: { source: "src-a" } },
      { userId: "u3", messageId: "m3", messageSnapshot: { source: "src-a" } },
    ];

    const result = aggregateNotificationKpis(matches);

    expect(result.sources[0].source).toBe("src-a");
    expect(result.sources[0].sent).toBe(2);
    expect(result.sources[1].source).toBe("src-b");
    expect(result.sources[1].sent).toBe(1);
  });

  it("uses (unknown) source when messageSnapshot is missing", () => {
    const matches = [{ userId: "u1", messageId: "m1" }];
    const result = aggregateNotificationKpis(matches);
    expect(result.sources[0].source).toBe("(unknown)");
  });

  it("counts clicked per source", () => {
    const matches = [
      { userId: "u1", messageId: "m1", clickedAt: "2026-01-01", messageSnapshot: { source: "src-a" } },
      { userId: "u2", messageId: "m2", clickedAt: undefined, messageSnapshot: { source: "src-a" } },
    ];

    const result = aggregateNotificationKpis(matches);
    expect(result.sources[0].clicked).toBe(1);
  });
});

describe("getMessageIdsForMode", () => {
  const matches = [
    { messageId: "m1", clickedAt: "2026-01-01", openedAt: "2026-01-01" },
    { messageId: "m2", clickedAt: "2026-01-01", openedAt: undefined },
    { messageId: "m3", clickedAt: undefined, openedAt: "2026-01-01" },
    { messageId: "m4", clickedAt: undefined, openedAt: undefined },
  ];

  it('returns all messageIds for mode "all"', () => {
    expect(getMessageIdsForMode(matches, "all")).toEqual(["m1", "m2", "m3", "m4"]);
  });

  it('returns only clicked messageIds for mode "clicked"', () => {
    expect(getMessageIdsForMode(matches, "clicked")).toEqual(["m1", "m2"]);
  });

  it('returns only opened messageIds for mode "opened"', () => {
    expect(getMessageIdsForMode(matches, "opened")).toEqual(["m1", "m3"]);
  });

  it("filters out null/empty messageIds", () => {
    const m = [{ messageId: "", clickedAt: "x" }, { messageId: null, clickedAt: "x" }];
    expect(getMessageIdsForMode(m, "all")).toEqual([]);
  });
});

describe("extractHeatmapPointsFromMessage", () => {
  it("returns empty array for city-wide messages", () => {
    expect(extractHeatmapPointsFromMessage({ cityWide: true })).toEqual([]);
  });

  it("returns empty array when geoJson is missing", () => {
    expect(extractHeatmapPointsFromMessage({})).toEqual([]);
  });

  it("extracts [lat, lng] from Point geometry", () => {
    const msg = {
      geoJson: {
        features: [
          { geometry: { type: "Point", coordinates: [23.3, 42.7] } },
        ],
      },
    };
    expect(extractHeatmapPointsFromMessage(msg)).toEqual([[42.7, 23.3]]);
  });

  it("extracts points from MultiPoint geometry", () => {
    const msg = {
      geoJson: {
        features: [
          { geometry: { type: "MultiPoint", coordinates: [[23.3, 42.7], [23.4, 42.8]] } },
        ],
      },
    };
    expect(extractHeatmapPointsFromMessage(msg)).toEqual([[42.7, 23.3], [42.8, 23.4]]);
  });

  it("extracts points from LineString geometry", () => {
    const msg = {
      geoJson: {
        features: [
          { geometry: { type: "LineString", coordinates: [[23.3, 42.7], [23.4, 42.8]] } },
        ],
      },
    };
    expect(extractHeatmapPointsFromMessage(msg)).toEqual([[42.7, 23.3], [42.8, 23.4]]);
  });

  it("extracts points from Polygon geometry", () => {
    const msg = {
      geoJson: {
        features: [
          { geometry: { type: "Polygon", coordinates: [[[23.3, 42.7], [23.4, 42.8], [23.3, 42.7]]] } },
        ],
      },
    };
    expect(extractHeatmapPointsFromMessage(msg)).toEqual([[42.7, 23.3], [42.8, 23.4], [42.7, 23.3]]);
  });
});

describe("buildHeatmapResult", () => {
  const threshold = HEATMAP_PRIVACY_THRESHOLD;
  const mockPoints: [number, number][] = [[42.7, 23.3]];

  it(`hides heatmap when count is below ${threshold}`, () => {
    const result = buildHeatmapResult(threshold - 1, mockPoints);
    expect(result.heatmapHiddenForPrivacy).toBe(true);
    expect(result.points).toEqual([]);
  });

  it(`hides heatmap when count is exactly ${threshold - 1}`, () => {
    const result = buildHeatmapResult(0, mockPoints);
    expect(result.heatmapHiddenForPrivacy).toBe(true);
  });

  it(`shows heatmap when count meets threshold (${threshold})`, () => {
    const result = buildHeatmapResult(threshold, mockPoints);
    expect(result.heatmapHiddenForPrivacy).toBe(false);
    expect(result.points).toEqual(mockPoints);
  });

  it("shows heatmap when count exceeds threshold", () => {
    const result = buildHeatmapResult(threshold + 10, mockPoints);
    expect(result.heatmapHiddenForPrivacy).toBe(false);
    expect(result.points).toEqual(mockPoints);
  });
});
