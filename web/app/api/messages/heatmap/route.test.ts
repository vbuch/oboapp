import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

// Mock data store — tests set this before each test
let mockMessagesData: Record<string, unknown>[] = [];

vi.mock("@/lib/db", () => ({
  getDb: vi.fn().mockImplementation(async () => ({
    messages: {
      findMany: vi.fn().mockImplementation(async (options?: any) => {
        let filtered = [...mockMessagesData];

        if (options?.where) {
          for (const clause of options.where) {
            filtered = filtered.filter((doc) => {
              const fieldValue = doc[clause.field];
              switch (clause.op) {
                case ">":
                  if (fieldValue == null) return false;
                  return fieldValue > clause.value;
                case "==":
                  return fieldValue === clause.value;
                default:
                  return true;
              }
            });
          }
        }

        return filtered;
      }),
    },
  })),
}));

const FINALIZED_AT = new Date("2024-01-01T00:00:00Z");

describe("GET /api/messages/heatmap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMessagesData = [];
  });

  it("returns 200 with an empty points array when no finalized messages exist", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ points: [] });
  });

  it("excludes non-finalized messages (missing finalizedAt)", async () => {
    mockMessagesData = [
      {
        _id: "no-final",
        geoJson: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [23.32, 42.69] },
              properties: {},
            },
          ],
        },
      },
    ];
    const res = await GET();
    const body = await res.json();
    expect(body.points).toHaveLength(0);
  });

  it("excludes city-wide messages", async () => {
    mockMessagesData = [
      {
        _id: "city-wide",
        finalizedAt: FINALIZED_AT,
        cityWide: true,
        geoJson: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [23.32, 42.69] },
              properties: {},
            },
          ],
        },
      },
    ];
    const res = await GET();
    const body = await res.json();
    expect(body.points).toHaveLength(0);
  });

  it("excludes messages without geoJson", async () => {
    mockMessagesData = [
      { _id: "no-geo", finalizedAt: FINALIZED_AT, geoJson: null },
    ];
    const res = await GET();
    const body = await res.json();
    expect(body.points).toHaveLength(0);
  });

  it("extracts a single point from a Point geometry", async () => {
    mockMessagesData = [
      {
        _id: "point-msg",
        finalizedAt: FINALIZED_AT,
        geoJson: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [23.3219, 42.6977] },
              properties: {},
            },
          ],
        },
      },
    ];
    const res = await GET();
    const body = await res.json();
    // GeoJSON [lng, lat] → heatmap [lat, lng]
    expect(body.points).toEqual([[42.6977, 23.3219]]);
  });

  it("extracts ALL vertices from a LineString (not just centroid)", async () => {
    const coords: [number, number][] = [
      [23.30, 42.69],
      [23.31, 42.70],
      [23.32, 42.71],
    ];
    mockMessagesData = [
      {
        _id: "line-msg",
        finalizedAt: FINALIZED_AT,
        geoJson: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "LineString", coordinates: coords },
              properties: {},
            },
          ],
        },
      },
    ];
    const res = await GET();
    const body = await res.json();
    expect(body.points).toHaveLength(3);
    // Each point should be [lat, lng]
    expect(body.points).toEqual(coords.map(([lng, lat]) => [lat, lng]));
  });

  it("extracts outer-ring vertices from a Polygon", async () => {
    const ring: [number, number][] = [
      [23.30, 42.69],
      [23.31, 42.69],
      [23.31, 42.70],
      [23.30, 42.70],
      [23.30, 42.69], // closing vertex
    ];
    mockMessagesData = [
      {
        _id: "poly-msg",
        finalizedAt: FINALIZED_AT,
        geoJson: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Polygon", coordinates: [ring] },
              properties: {},
            },
          ],
        },
      },
    ];
    const res = await GET();
    const body = await res.json();
    expect(body.points).toHaveLength(ring.length);
    expect(body.points).toEqual(ring.map(([lng, lat]) => [lat, lng]));
  });

  it("accumulates points from multiple features in one message", async () => {
    mockMessagesData = [
      {
        _id: "multi-feature",
        finalizedAt: FINALIZED_AT,
        geoJson: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [23.30, 42.69] },
              properties: {},
            },
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [23.31, 42.70],
                  [23.32, 42.71],
                ],
              },
              properties: {},
            },
          ],
        },
      },
    ];
    const res = await GET();
    const body = await res.json();
    // 1 point from Point + 2 vertices from LineString = 3
    expect(body.points).toHaveLength(3);
  });

  it("accumulates points from multiple messages", async () => {
    mockMessagesData = [
      {
        _id: "msg-1",
        finalizedAt: FINALIZED_AT,
        geoJson: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [23.30, 42.69] },
              properties: {},
            },
          ],
        },
      },
      {
        _id: "msg-2",
        finalizedAt: FINALIZED_AT,
        geoJson: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [23.31, 42.70],
                  [23.32, 42.71],
                ],
              },
              properties: {},
            },
          ],
        },
      },
    ];
    const res = await GET();
    const body = await res.json();
    expect(body.points).toHaveLength(3);
  });

  it("returns 500 when the database throws", async () => {
    vi.mocked((await import("@/lib/db")).getDb).mockRejectedValueOnce(
      new Error("DB error"),
    );
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Failed to fetch heatmap data" });
  });
});
