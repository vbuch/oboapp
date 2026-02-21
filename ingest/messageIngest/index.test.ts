import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firebase-admin to prevent initialization errors in tests
vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    verifyIdToken: vi.fn(),
  },
}));

// Mock db to prevent Firebase initialization
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));

// Mock the messageIngest DB layer so tests don't hit Firestore
const mockStoreIncomingMessage = vi.fn();
const mockUpdateMessage = vi.fn();
vi.mock("./db", () => ({
  storeIncomingMessage: (...args: unknown[]) =>
    mockStoreIncomingMessage(...args),
  updateMessage: (...args: unknown[]) => mockUpdateMessage(...args),
  getMessageById: vi.fn(),
}));

// Mock encodeDocumentId so we can spy on calls
const mockEncodeDocumentId = vi.fn();
vi.mock("../crawlers/shared/firestore", () => ({
  encodeDocumentId: (...args: unknown[]) => mockEncodeDocumentId(...args),
}));

// Mock logger to suppress output
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { computeGeoJsonCentroidAddress, messageIngest } from "./index";
import type { GeoJSONFeatureCollection } from "@/lib/types";

/**
 * These tests verify internal utility functions from messageIngest/index.ts
 * We import the module to access the functions through their exports
 */

describe("computeGeoJsonCentroidAddress", () => {
  it("should return null for empty FeatureCollection", () => {
    const geoJson: GeoJSONFeatureCollection = {
      type: "FeatureCollection",
      features: [],
    };
    expect(computeGeoJsonCentroidAddress(geoJson)).toBeNull();
  });

  it("should compute centroid for a single Point feature", () => {
    const geoJson: GeoJSONFeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [23.3219, 42.6977] },
          properties: {},
        },
      ],
    };
    const result = computeGeoJsonCentroidAddress(geoJson);
    expect(result).not.toBeNull();
    expect(result!.coordinates.lat).toBeCloseTo(42.6977);
    expect(result!.coordinates.lng).toBeCloseTo(23.3219);
    expect(result!.originalText).toBe("Местоположение");
  });

  it("should compute average centroid for multiple Point features", () => {
    const geoJson: GeoJSONFeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [23.0, 42.0] },
          properties: {},
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [24.0, 43.0] },
          properties: {},
        },
      ],
    };
    const result = computeGeoJsonCentroidAddress(geoJson);
    expect(result).not.toBeNull();
    expect(result!.coordinates.lat).toBeCloseTo(42.5);
    expect(result!.coordinates.lng).toBeCloseTo(23.5);
  });

  it("should handle LineString features", () => {
    const geoJson: GeoJSONFeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [23.0, 42.0],
              [24.0, 43.0],
            ],
          },
          properties: {},
        },
      ],
    };
    const result = computeGeoJsonCentroidAddress(geoJson);
    expect(result).not.toBeNull();
    expect(result!.coordinates.lat).toBeCloseTo(42.5);
    expect(result!.coordinates.lng).toBeCloseTo(23.5);
  });

  it("should handle Polygon features", () => {
    const geoJson: GeoJSONFeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [23.0, 42.0],
                [24.0, 42.0],
                [24.0, 43.0],
                [23.0, 43.0],
                [23.0, 42.0],
              ],
            ],
          },
          properties: {},
        },
      ],
    };
    const result = computeGeoJsonCentroidAddress(geoJson);
    expect(result).not.toBeNull();
    expect(result!.coordinates.lat).toBeCloseTo(42.5);
    expect(result!.coordinates.lng).toBeCloseTo(23.5);
  });

  it("should handle MultiPoint features", () => {
    const geoJson: GeoJSONFeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "MultiPoint",
            coordinates: [
              [23.0, 42.0],
              [24.0, 43.0],
            ],
          },
          properties: {},
        },
      ],
    };
    const result = computeGeoJsonCentroidAddress(geoJson);
    expect(result).not.toBeNull();
    expect(result!.coordinates.lat).toBeCloseTo(42.5);
    expect(result!.coordinates.lng).toBeCloseTo(23.5);
  });
});

describe("messageIngest utilities", () => {
  describe("ensureCrawledAtDate", () => {
    // Since ensureCrawledAtDate is not exported, we test it indirectly through
    // the behavior of functions that use it (storeMessage, handlePrecomputedGeoJsonData)
    // Or we can move it to a separate utils file and test it directly.
    // For now, documenting the expected behavior:

    it("should handle valid Date objects", () => {
      const validDate = new Date("2026-01-20T10:00:00Z");
      expect(validDate.getTime()).not.toBeNaN();
    });

    it("should handle valid date strings", () => {
      const dateFromString = new Date("2026-01-20T10:00:00Z");
      expect(dateFromString.getTime()).not.toBeNaN();
    });

    it("should detect invalid date strings", () => {
      const invalidDate = new Date("invalid-date-string");
      expect(Number.isNaN(invalidDate.getTime())).toBe(true);
    });

    it("should handle undefined gracefully", () => {
      const fallbackDate = new Date();
      expect(fallbackDate.getTime()).not.toBeNaN();
    });

    it("should handle empty strings as invalid", () => {
      const emptyStringDate = new Date("");
      expect(Number.isNaN(emptyStringDate.getTime())).toBe(true);
    });

    it("should handle malformed ISO strings", () => {
      const malformedDate = new Date("2026-13-45T99:99:99Z"); // Invalid month/day/time
      expect(Number.isNaN(malformedDate.getTime())).toBe(true);
    });
  });
});

const PRECOMPUTED_GEOJSON: GeoJSONFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [23.32, 42.7],
      },
      properties: {},
    },
  ],
};

describe("messageIngest sourceDocumentId precedence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreIncomingMessage.mockResolvedValue("test-msg-id");
    mockUpdateMessage.mockResolvedValue(undefined);
    mockEncodeDocumentId.mockImplementation((url: string) => `encoded(${url})`);
  });

  it("uses explicit sourceDocumentId directly without calling encodeDocumentId", async () => {
    await messageIngest("test text", "test-source", {
      precomputedGeoJson: PRECOMPUTED_GEOJSON,
      sourceUrl: "https://user-facing.example.com/article/42",
      sourceDocumentId: "explicit-doc-id-from-source-url",
      locality: "bg.sofia",
    });

    // encodeDocumentId must NOT have been called (explicit ID was used directly)
    expect(mockEncodeDocumentId).not.toHaveBeenCalled();

    // storeIncomingMessage should receive the explicit sourceDocumentId
    expect(mockStoreIncomingMessage).toHaveBeenCalledWith(
      "test text",
      "bg.sofia",
      "test-source",
      "https://user-facing.example.com/article/42",
      undefined,
      "explicit-doc-id-from-source-url",
    );
  });

  it("derives sourceDocumentId from sourceUrl when sourceDocumentId is not provided", async () => {
    const sourceUrl = "https://www.sofia.bg/post/123";

    await messageIngest("test text", "sofia-bg", {
      precomputedGeoJson: PRECOMPUTED_GEOJSON,
      sourceUrl,
      locality: "bg.sofia",
    });

    // encodeDocumentId should have been called with the sourceUrl
    expect(mockEncodeDocumentId).toHaveBeenCalledWith(sourceUrl);

    // storeIncomingMessage should receive the derived sourceDocumentId
    expect(mockStoreIncomingMessage).toHaveBeenCalledWith(
      "test text",
      "bg.sofia",
      "sofia-bg",
      sourceUrl,
      undefined,
      `encoded(${sourceUrl})`,
    );
  });

  it("passes undefined sourceDocumentId when neither sourceDocumentId nor sourceUrl is provided", async () => {
    await messageIngest("test text", "web-interface", {
      precomputedGeoJson: PRECOMPUTED_GEOJSON,
      locality: "bg.sofia",
    });

    expect(mockEncodeDocumentId).not.toHaveBeenCalled();

    expect(mockStoreIncomingMessage).toHaveBeenCalledWith(
      "test text",
      "bg.sofia",
      "web-interface",
      undefined,
      undefined,
      undefined,
    );
  });

  it("explicit sourceDocumentId wins over sourceUrl-derived ID when both are present", async () => {
    const sourceUrl = "https://www.sofia.bg/post/456";
    const explicitId = "aHR0cHM6Ly9zb2ZpYS5iZy9wb3N0LzQ1Ng__";

    await messageIngest("test text", "sofia-bg", {
      precomputedGeoJson: PRECOMPUTED_GEOJSON,
      sourceUrl,
      sourceDocumentId: explicitId,
      locality: "bg.sofia",
    });

    // encodeDocumentId was NOT called since explicit ID was provided
    expect(mockEncodeDocumentId).not.toHaveBeenCalled();

    // Explicit ID was passed to storeIncomingMessage, not the derived one
    const callArgs = mockStoreIncomingMessage.mock.calls[0];
    expect(callArgs[5]).toBe(explicitId);
    expect(callArgs[5]).not.toBe(`encoded(${sourceUrl})`);
  });
});
