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

/** Helper: build a Request with optional query-string params */
function makeRequest(params?: Record<string, string>): Request {
  const url = new URL("http://localhost/api/messages/heatmap");
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return new Request(url.toString());
}

describe("GET /api/messages/heatmap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMessagesData = [];
  });

  it("returns 200 with an empty points array when no finalized messages exist", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ points: [], messageCount: 0, oldestDate: null });
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
    const res = await GET(makeRequest());
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
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.points).toHaveLength(0);
  });

  it("excludes messages without geoJson", async () => {
    mockMessagesData = [
      { _id: "no-geo", finalizedAt: FINALIZED_AT, geoJson: null },
    ];
    const res = await GET(makeRequest());
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
    const res = await GET(makeRequest());
    const body = await res.json();
    // GeoJSON [lng, lat] → heatmap [lat, lng]
    expect(body.points).toEqual([[42.6977, 23.3219]]);
    expect(body.messageCount).toBe(1);
    expect(body.oldestDate).toBe(FINALIZED_AT.toISOString());
  });

  it("extracts exactly ONE centroid from a LineString geometry", async () => {
    mockMessagesData = [
      {
        _id: "line-msg",
        finalizedAt: FINALIZED_AT,
        geoJson: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [23.30, 42.69],
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
    const res = await GET(makeRequest());
    const body = await res.json();
    // A LineString is a single geometry → exactly 1 centroid
    expect(body.points).toHaveLength(1);
    const [lat, lng] = body.points[0];
    // Centroid is within the Sofia bounding box
    expect(lat).toBeGreaterThan(42.6);
    expect(lat).toBeLessThan(42.8);
    expect(lng).toBeGreaterThan(23.2);
    expect(lng).toBeLessThan(23.4);
  });

  it("extracts exactly ONE centroid from a Polygon geometry", async () => {
    mockMessagesData = [
      {
        _id: "poly-msg",
        finalizedAt: FINALIZED_AT,
        geoJson: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [23.30, 42.69],
                    [23.31, 42.69],
                    [23.31, 42.70],
                    [23.30, 42.70],
                    [23.30, 42.69],
                  ],
                ],
              },
              properties: {},
            },
          ],
        },
      },
    ];
    const res = await GET(makeRequest());
    const body = await res.json();
    // A Polygon is a single geometry → exactly 1 centroid
    expect(body.points).toHaveLength(1);
  });

  it("extracts one point per coordinate from a MultiPoint geometry", async () => {
    mockMessagesData = [
      {
        _id: "multipoint-msg",
        finalizedAt: FINALIZED_AT,
        geoJson: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "MultiPoint",
                coordinates: [
                  [23.30, 42.69],
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
    const res = await GET(makeRequest());
    const body = await res.json();
    // MultiPoint: each coordinate is a distinct pin → 3 points
    expect(body.points).toHaveLength(3);
    expect(body.points).toEqual([
      [42.69, 23.30],
      [42.70, 23.31],
      [42.71, 23.32],
    ]);
  });

  it("accumulates one point per feature across multiple features in one message", async () => {
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
    const res = await GET(makeRequest());
    const body = await res.json();
    // 1 point from Point + 1 centroid from LineString = 2
    expect(body.points).toHaveLength(2);
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
    const res = await GET(makeRequest());
    const body = await res.json();
    // 1 point from msg-1 + 1 centroid from msg-2 = 2
    expect(body.points).toHaveLength(2);
  });

  it("reports correct messageCount and oldestDate across multiple messages", async () => {
    const older = new Date("2023-06-01T00:00:00Z");
    const newer = new Date("2024-01-01T00:00:00Z");
    mockMessagesData = [
      {
        _id: "msg-newer",
        finalizedAt: newer,
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
        _id: "msg-older",
        finalizedAt: older,
        geoJson: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [23.31, 42.70] },
              properties: {},
            },
          ],
        },
      },
      // City-wide message should NOT be counted
      {
        _id: "msg-citywide",
        finalizedAt: new Date("2022-01-01T00:00:00Z"),
        cityWide: true,
        geoJson: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [23.32, 42.71] },
              properties: {},
            },
          ],
        },
      },
    ];
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.messageCount).toBe(2);
    expect(body.oldestDate).toBe(older.toISOString());
  });

  it("returns 500 when the database throws", async () => {
    vi.mocked((await import("@/lib/db")).getDb).mockRejectedValueOnce(
      new Error("DB error"),
    );
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Failed to fetch heatmap data" });
  });

  describe("category filtering", () => {
    beforeEach(() => {
      mockMessagesData = [
        {
          _id: "water-msg",
          finalizedAt: FINALIZED_AT,
          categories: ["water"],
          source: "sofiyska-voda",
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
          _id: "electricity-msg",
          finalizedAt: FINALIZED_AT,
          categories: ["electricity"],
          source: "erm-zapad",
          geoJson: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [23.31, 42.70] },
                properties: {},
              },
            ],
          },
        },
        {
          _id: "uncategorized-msg",
          finalizedAt: FINALIZED_AT,
          categories: [],
          source: "sofia-bg",
          geoJson: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [23.32, 42.71] },
                properties: {},
              },
            ],
          },
        },
      ];
    });

    it("returns all messages when no category filter is applied", async () => {
      const res = await GET(makeRequest());
      const body = await res.json();
      expect(body.messageCount).toBe(3);
    });

    it("filters to only matching category messages", async () => {
      const res = await GET(makeRequest({ categories: "water" }));
      const body = await res.json();
      expect(body.messageCount).toBe(1);
    });

    it("filters to multiple categories (OR logic)", async () => {
      const res = await GET(
        makeRequest({ categories: "water,electricity" }),
      );
      const body = await res.json();
      expect(body.messageCount).toBe(2);
    });

    it("filters to uncategorized messages", async () => {
      const res = await GET(makeRequest({ categories: "uncategorized" }));
      const body = await res.json();
      expect(body.messageCount).toBe(1);
    });

    it("combines real category and uncategorized in one filter", async () => {
      const res = await GET(
        makeRequest({ categories: "water,uncategorized" }),
      );
      const body = await res.json();
      expect(body.messageCount).toBe(2);
    });
  });

  describe("source filtering", () => {
    beforeEach(() => {
      mockMessagesData = [
        {
          _id: "msg-a",
          finalizedAt: FINALIZED_AT,
          categories: ["water"],
          source: "sofiyska-voda",
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
          _id: "msg-b",
          finalizedAt: FINALIZED_AT,
          categories: ["electricity"],
          source: "erm-zapad",
          geoJson: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [23.31, 42.70] },
                properties: {},
              },
            ],
          },
        },
      ];
    });

    it("returns all messages when no source filter is applied", async () => {
      const res = await GET(makeRequest());
      const body = await res.json();
      expect(body.messageCount).toBe(2);
    });

    it("filters to only matching source messages", async () => {
      const res = await GET(makeRequest({ sources: "sofiyska-voda" }));
      const body = await res.json();
      expect(body.messageCount).toBe(1);
    });

    it("filters to multiple sources (OR logic)", async () => {
      const res = await GET(
        makeRequest({ sources: "sofiyska-voda,erm-zapad" }),
      );
      const body = await res.json();
      expect(body.messageCount).toBe(2);
    });

    it("returns empty result when source does not match any message", async () => {
      const res = await GET(makeRequest({ sources: "unknown-source" }));
      const body = await res.json();
      expect(body.messageCount).toBe(0);
      expect(body.points).toHaveLength(0);
    });
  });

  describe("combined category and source filtering", () => {
    it("applies both category and source filters simultaneously", async () => {
      mockMessagesData = [
        {
          _id: "match",
          finalizedAt: FINALIZED_AT,
          categories: ["water"],
          source: "sofiyska-voda",
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
          _id: "wrong-source",
          finalizedAt: FINALIZED_AT,
          categories: ["water"],
          source: "erm-zapad",
          geoJson: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [23.31, 42.70] },
                properties: {},
              },
            ],
          },
        },
        {
          _id: "wrong-category",
          finalizedAt: FINALIZED_AT,
          categories: ["electricity"],
          source: "sofiyska-voda",
          geoJson: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [23.32, 42.71] },
                properties: {},
              },
            ],
          },
        },
      ];

      const res = await GET(
        makeRequest({ categories: "water", sources: "sofiyska-voda" }),
      );
      const body = await res.json();
      expect(body.messageCount).toBe(1);
    });
  });
});
