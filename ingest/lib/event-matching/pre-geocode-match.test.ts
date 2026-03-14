import { describe, it, expect, vi, beforeEach } from "vitest";
import { preGeocodeMatch } from "./pre-geocode-match";
import {
  PRE_GEOCODE_MATCH_THRESHOLD,
  MIN_REUSABLE_GEOMETRY_QUALITY,
} from "./constants";

const sampleGeometry = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [23.32, 42.69] as [number, number],
      },
      properties: {} as Record<string, unknown>,
    },
  ],
};

const mockFindCandidates = vi.fn().mockResolvedValue([]);
const mockDb = {
  events: { findCandidates: mockFindCandidates },
} as any;

const baseMessage = {
  timespanStart: "2025-03-03T08:00:00Z" as string | null,
  timespanEnd: "2025-03-03T18:00:00Z" as string | null,
  categories: ["water-outage"],
  cityWide: false,
  locality: "bg.sofia",
};

describe("preGeocodeMatch", () => {
  beforeEach(() => {
    mockFindCandidates.mockClear();
  });

  it("returns null when no candidates", async () => {
    mockFindCandidates.mockResolvedValueOnce([]);
    const result = await preGeocodeMatch(mockDb, baseMessage);
    expect(result).toBeNull();
  });

  it("returns null when candidates have low geometry quality", async () => {
    mockFindCandidates.mockResolvedValueOnce([
      {
        _id: "evt-1",
        geometryQuality: 1, // below MIN_REUSABLE_GEOMETRY_QUALITY
        geometry: sampleGeometry,
        timespanStart: "2025-03-03T08:00:00Z",
        timespanEnd: "2025-03-03T18:00:00Z",
        categories: ["water-outage"],
      },
    ]);

    const result = await preGeocodeMatch(mockDb, baseMessage);
    expect(result).toBeNull();
  });

  it("returns null when candidates have no geometry features", async () => {
    mockFindCandidates.mockResolvedValueOnce([
      {
        _id: "evt-1",
        geometryQuality: 3,
        geometry: { type: "FeatureCollection", features: [] },
        timespanStart: "2025-03-03T08:00:00Z",
        timespanEnd: "2025-03-03T18:00:00Z",
        categories: ["water-outage"],
      },
    ]);

    const result = await preGeocodeMatch(mockDb, baseMessage);
    expect(result).toBeNull();
  });

  it("matches high-quality event with identical time + categories", async () => {
    mockFindCandidates.mockResolvedValueOnce([
      {
        _id: "evt-1",
        geometryQuality: 3,
        geometry: sampleGeometry,
        timespanStart: "2025-03-03T08:00:00Z",
        timespanEnd: "2025-03-03T18:00:00Z",
        categories: ["water-outage"],
      },
    ]);

    const result = await preGeocodeMatch(mockDb, baseMessage);
    expect(result).not.toBeNull();
    expect(result!.event._id).toBe("evt-1");
    expect(result!.geometry).toBe(sampleGeometry);
    expect(result!.score).toBeGreaterThanOrEqual(PRE_GEOCODE_MATCH_THRESHOLD);
  });

  it("rejects when score is below PRE_GEOCODE_MATCH_THRESHOLD", async () => {
    // Different categories → categoryMatch = 0
    // Partial time overlap → timeOverlap < 1
    mockFindCandidates.mockResolvedValueOnce([
      {
        _id: "evt-1",
        geometryQuality: 3,
        geometry: sampleGeometry,
        timespanStart: "2025-03-03T08:00:00Z",
        timespanEnd: "2025-03-03T18:00:00Z",
        categories: ["road-repair"], // no overlap with water-outage
      },
    ]);

    // Message with partial time overlap and no category overlap
    const result = await preGeocodeMatch(mockDb, {
      ...baseMessage,
      timespanStart: "2025-03-03T12:00:00Z",
      timespanEnd: "2025-03-04T12:00:00Z",
      categories: ["water-outage"],
    });

    // timeOverlap = 6h / 28h ≈ 0.214, categoryMatch = 0
    // score = 0.7 * 0.214 + 0.3 * 0 ≈ 0.15 → below threshold
    expect(result).toBeNull();
  });

  it("returns event with quality >= MIN_REUSABLE_GEOMETRY_QUALITY", async () => {
    mockFindCandidates.mockResolvedValueOnce([
      {
        _id: "evt-1",
        geometryQuality: MIN_REUSABLE_GEOMETRY_QUALITY,
        geometry: sampleGeometry,
        timespanStart: "2025-03-03T08:00:00Z",
        timespanEnd: "2025-03-03T18:00:00Z",
        categories: ["water-outage"],
      },
    ]);

    const result = await preGeocodeMatch(mockDb, baseMessage);
    expect(result).not.toBeNull();
    expect(result!.event.geometryQuality).toBe(MIN_REUSABLE_GEOMETRY_QUALITY);
  });

  it("picks the highest-scoring candidate", async () => {
    mockFindCandidates.mockResolvedValueOnce([
      {
        _id: "evt-low",
        geometryQuality: 3,
        geometry: sampleGeometry,
        timespanStart: "2025-03-03T08:00:00Z",
        timespanEnd: "2025-03-03T18:00:00Z",
        categories: ["road-repair"], // no category overlap → lower score
      },
      {
        _id: "evt-high",
        geometryQuality: 3,
        geometry: sampleGeometry,
        timespanStart: "2025-03-03T08:00:00Z",
        timespanEnd: "2025-03-03T18:00:00Z",
        categories: ["water-outage"], // perfect category match → higher score
      },
    ]);

    const result = await preGeocodeMatch(mockDb, baseMessage);
    expect(result).not.toBeNull();
    expect(result!.event._id).toBe("evt-high");
  });

  it("handles city-wide messages (skips spatial, uses time+category)", async () => {
    mockFindCandidates.mockResolvedValueOnce([
      {
        _id: "evt-cw",
        geometryQuality: 3,
        geometry: sampleGeometry,
        timespanStart: "2025-03-03T08:00:00Z",
        timespanEnd: "2025-03-03T18:00:00Z",
        categories: ["water-outage"],
        cityWide: true,
      },
    ]);

    const result = await preGeocodeMatch(mockDb, {
      ...baseMessage,
      cityWide: true,
    });

    expect(result).not.toBeNull();
  });
});
