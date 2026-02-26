import { describe, it, expect, vi } from "vitest";
import {
  toLatLng,
  getCentroid,
  createFeatureKey,
  jitterDuplicatePositions,
  getFeaturesCentroid,
} from "./geometry-utils";

describe("geometry-utils", () => {
  describe("toLatLng", () => {
    it("should convert valid GeoJSON coordinate to LatLng", () => {
      const coord = [23.3219, 42.6977]; // Sofia coordinates: [lng, lat]
      const result = toLatLng(coord);

      expect(result).toEqual({
        lat: 42.6977,
        lng: 23.3219,
      });
    });

    it("should handle coordinates with elevation", () => {
      const coord = [23.3219, 42.6977, 550]; // [lng, lat, elevation]
      const result = toLatLng(coord);

      expect(result).toEqual({
        lat: 42.6977,
        lng: 23.3219,
      });
    });

    it("should handle negative coordinates", () => {
      const coord = [-74.006, 40.7128]; // NYC coordinates
      const result = toLatLng(coord);

      expect(result).toEqual({
        lat: 40.7128,
        lng: -74.006,
      });
    });

    it("should handle zero coordinates", () => {
      const coord = [0, 0];
      const result = toLatLng(coord);

      expect(result).toEqual({
        lat: 0,
        lng: 0,
      });
    });

    it("should throw error for null coordinate", () => {
      expect(() => toLatLng(null as any)).toThrow(
        "Invalid coordinate: must be an array with at least 2 elements",
      );
    });

    it("should throw error for undefined coordinate", () => {
      expect(() => toLatLng(undefined as any)).toThrow(
        "Invalid coordinate: must be an array with at least 2 elements",
      );
    });

    it("should throw error for empty array", () => {
      expect(() => toLatLng([])).toThrow(
        "Invalid coordinate: must be an array with at least 2 elements",
      );
    });

    it("should throw error for array with only one element", () => {
      expect(() => toLatLng([23.3219])).toThrow(
        "Invalid coordinate: must be an array with at least 2 elements",
      );
    });

    it("should throw error for non-number coordinates", () => {
      expect(() => toLatLng(["23.3219", "42.6977"] as any)).toThrow(
        "Invalid coordinate: longitude and latitude must be numbers",
      );
    });

    it("should throw error for mixed types", () => {
      expect(() => toLatLng([23.3219, "42.6977"] as any)).toThrow(
        "Invalid coordinate: longitude and latitude must be numbers",
      );
    });

    it("should throw error for NaN values", () => {
      expect(() => toLatLng([NaN, 42.6977])).toThrow(
        "Invalid coordinate: longitude and latitude must be numbers",
      );
    });
  });

  describe("getCentroid", () => {
    describe("Point geometry", () => {
      it("should return centroid for valid Point", () => {
        const geometry = {
          type: "Point",
          coordinates: [23.3219, 42.6977],
        } as any;

        const result = getCentroid(geometry);
        expect(result).toEqual({
          lat: 42.6977,
          lng: 23.3219,
        });
      });

      it("should handle Point with elevation", () => {
        const geometry = {
          type: "Point",
          coordinates: [23.3219, 42.6977, 550],
        } as any;

        const result = getCentroid(geometry);
        expect(result).toEqual({
          lat: 42.6977,
          lng: 23.3219,
        });
      });

      it("should return null for Point with invalid coordinates", () => {
        const geometry = {
          type: "Point",
          coordinates: [],
        } as any;

        const result = getCentroid(geometry);
        expect(result).toBeNull();
      });

      it("should return null for Point with null coordinates", () => {
        const geometry = {
          type: "Point",
          coordinates: null,
        } as any;

        const result = getCentroid(geometry);
        expect(result).toBeNull();
      });
    });

    describe("LineString geometry", () => {
      it("should calculate centroid for valid LineString", () => {
        const geometry = {
          type: "LineString",
          coordinates: [
            [23.3219, 42.6977], // Sofia center
            [23.3319, 42.7077], // North-east of Sofia
          ],
        } as any;

        const result = getCentroid(geometry);
        expect(result).toBeDefined();
        expect(result!.lat).toBeCloseTo(42.7027, 3);
        expect(result!.lng).toBeCloseTo(23.3269, 3);
      });

      it("should handle LineString with multiple points", () => {
        const geometry = {
          type: "LineString",
          coordinates: [
            [23.3219, 42.6977],
            [23.3319, 42.7077],
            [23.3419, 42.7177],
            [23.3519, 42.7277],
          ],
        } as any;

        const result = getCentroid(geometry);
        expect(result).toBeDefined();
        expect(typeof result!.lat).toBe("number");
        expect(typeof result!.lng).toBe("number");
      });

      it("should return null for LineString with empty coordinates", () => {
        const geometry = {
          type: "LineString",
          coordinates: [],
        } as any;

        const result = getCentroid(geometry);
        expect(result).toBeNull();
      });

      it("should return null for LineString with null coordinates", () => {
        const geometry = {
          type: "LineString",
          coordinates: null,
        } as any;

        const result = getCentroid(geometry);
        expect(result).toBeNull();
      });

      it("should handle error in turf calculation", () => {
        // Mock console.error to avoid noise in test output
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        const geometry = {
          type: "LineString",
          coordinates: [[null, null]], // Invalid coordinates that will cause turf to throw
        } as any;

        const result = getCentroid(geometry);
        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });

    describe("Polygon geometry", () => {
      it("should calculate centroid for valid Polygon", () => {
        const geometry = {
          type: "Polygon",
          coordinates: [
            [
              [23.3219, 42.6977], // Sofia area polygon
              [23.3319, 42.6977],
              [23.3319, 42.7077],
              [23.3219, 42.7077],
              [23.3219, 42.6977], // Closed polygon
            ],
          ],
        } as any;

        const result = getCentroid(geometry);
        expect(result).toBeDefined();
        expect(result!.lat).toBeCloseTo(42.7027, 3);
        expect(result!.lng).toBeCloseTo(23.3269, 3);
      });

      it("should handle Polygon with holes", () => {
        const geometry = {
          type: "Polygon",
          coordinates: [
            // Outer ring
            [
              [23.3219, 42.6977],
              [23.3419, 42.6977],
              [23.3419, 42.7177],
              [23.3219, 42.7177],
              [23.3219, 42.6977],
            ],
            // Inner ring (hole)
            [
              [23.3269, 42.7027],
              [23.3369, 42.7027],
              [23.3369, 42.7127],
              [23.3269, 42.7127],
              [23.3269, 42.7027],
            ],
          ],
        } as any;

        const result = getCentroid(geometry);
        expect(result).toBeDefined();
        expect(typeof result!.lat).toBe("number");
        expect(typeof result!.lng).toBe("number");
      });

      it("should return null for Polygon with empty coordinates", () => {
        const geometry = {
          type: "Polygon",
          coordinates: [],
        } as any;

        const result = getCentroid(geometry);
        expect(result).toBeNull();
      });

      it("should return null for Polygon with null coordinates", () => {
        const geometry = {
          type: "Polygon",
          coordinates: null,
        } as any;

        const result = getCentroid(geometry);
        expect(result).toBeNull();
      });
    });

    describe("unsupported geometry types", () => {
      it("should return null for MultiPoint", () => {
        const geometry = {
          type: "MultiPoint",
          coordinates: [
            [23.3219, 42.6977],
            [23.3319, 42.7077],
          ],
        } as any;

        const result = getCentroid(geometry);
        expect(result).toBeNull();
      });

      it("should return null for MultiLineString", () => {
        const geometry = {
          type: "MultiLineString",
          coordinates: [
            [
              [23.3219, 42.6977],
              [23.3319, 42.7077],
            ],
            [
              [23.3419, 42.7177],
              [23.3519, 42.7277],
            ],
          ],
        } as any;

        const result = getCentroid(geometry);
        expect(result).toBeNull();
      });

      it("should return null for unknown geometry type", () => {
        const geometry = {
          type: "UnknownType",
          coordinates: [[23.3219, 42.6977]],
        } as any;

        const result = getCentroid(geometry);
        expect(result).toBeNull();
      });
    });

    describe("error handling", () => {
      it("should return null for null geometry", () => {
        const result = getCentroid(null as any);
        expect(result).toBeNull();
      });

      it("should return null for undefined geometry", () => {
        const result = getCentroid(undefined as any);
        expect(result).toBeNull();
      });

      it("should return null for geometry without type", () => {
        const geometry = {
          coordinates: [23.3219, 42.6977],
        } as any;

        const result = getCentroid(geometry);
        expect(result).toBeNull();
      });

      it("should handle and log errors from turf operations", () => {
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        // This should cause turf to throw an error - invalid coordinates for LineString
        const geometry = {
          type: "LineString",
          coordinates: [
            [Infinity, Infinity],
            [NaN, NaN],
          ], // Invalid coordinates that will cause turf to throw
        } as any;

        const result = getCentroid(geometry);
        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          "Error calculating centroid:",
          expect.any(Error),
        );

        consoleSpy.mockRestore();
      });
    });
  });

  describe("jitterDuplicatePositions", () => {
    it("should not modify unique positions", () => {
      const positions = [
        { lat: 42.6977, lng: 23.3219, id: "1" },
        { lat: 42.6978, lng: 23.322, id: "2" },
        { lat: 42.6979, lng: 23.3221, id: "3" },
      ];

      const result = jitterDuplicatePositions(positions);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(positions[0]);
      expect(result[1]).toEqual(positions[1]);
      expect(result[2]).toEqual(positions[2]);
    });

    it("should jitter duplicate positions", () => {
      const positions = [
        { lat: 42.6977, lng: 23.3219, id: "1" },
        { lat: 42.6977, lng: 23.3219, id: "2" },
        { lat: 42.6977, lng: 23.3219, id: "3" },
      ];

      const result = jitterDuplicatePositions(positions);

      expect(result).toHaveLength(3);

      // Check that all positions are different after jittering
      const coords = result.map((p) => `${p.lat},${p.lng}`);
      const uniqueCoords = new Set(coords);
      expect(uniqueCoords.size).toBe(3);

      // Check that jittered positions are close to original (within ~10 meters)
      const maxDistance = 15 / 111000; // ~15 meters in degrees
      result.forEach((pos) => {
        const latDiff = Math.abs(pos.lat - 42.6977);
        const lngDiff = Math.abs(pos.lng - 23.3219);
        expect(latDiff).toBeLessThan(maxDistance);
        expect(lngDiff).toBeLessThan(maxDistance);
      });

      // Check that original metadata is preserved
      expect(result[0].id).toBe("1");
      expect(result[1].id).toBe("2");
      expect(result[2].id).toBe("3");
    });

    it("should handle mix of unique and duplicate positions", () => {
      const positions = [
        { lat: 42.6977, lng: 23.3219, id: "1" }, // Unique
        { lat: 42.6978, lng: 23.322, id: "2" }, // Duplicate group 1
        { lat: 42.6978, lng: 23.322, id: "3" }, // Duplicate group 1
        { lat: 42.6979, lng: 23.3221, id: "4" }, // Unique
        { lat: 42.6978, lng: 23.322, id: "5" }, // Duplicate group 1
      ];

      const result = jitterDuplicatePositions(positions);

      expect(result).toHaveLength(5);

      // Unique positions should remain unchanged
      const pos1 = result.find((p) => p.id === "1");
      expect(pos1).toEqual(positions[0]);

      const pos4 = result.find((p) => p.id === "4");
      expect(pos4).toEqual(positions[3]);

      // Duplicate positions should be different from each other
      const duplicateGroup = result.filter((p) =>
        ["2", "3", "5"].includes(p.id),
      );
      const duplicateCoords = duplicateGroup.map((p) => `${p.lat},${p.lng}`);
      const uniqueDuplicateCoords = new Set(duplicateCoords);
      expect(uniqueDuplicateCoords.size).toBe(3);
    });

    it("should handle two pairs of duplicates", () => {
      const positions = [
        { lat: 42.6977, lng: 23.3219, id: "1" },
        { lat: 42.6977, lng: 23.3219, id: "2" },
        { lat: 42.6978, lng: 23.322, id: "3" },
        { lat: 42.6978, lng: 23.322, id: "4" },
      ];

      const result = jitterDuplicatePositions(positions);

      expect(result).toHaveLength(4);

      // Check that both pairs are separated
      const coords = result.map((p) => `${p.lat},${p.lng}`);
      const uniqueCoords = new Set(coords);
      expect(uniqueCoords.size).toBe(4);
    });

    it("should handle empty array", () => {
      const positions: Array<{ lat: number; lng: number }> = [];
      const result = jitterDuplicatePositions(positions);
      expect(result).toEqual([]);
    });

    it("should handle single position", () => {
      const positions = [{ lat: 42.6977, lng: 23.3219, id: "1" }];
      const result = jitterDuplicatePositions(positions);
      expect(result).toEqual(positions);
    });

    it("should throw error for non-array input", () => {
      expect(() => jitterDuplicatePositions(null as any)).toThrow(
        "Invalid input: positions must be an array",
      );
    });

    it("should throw error for invalid position with non-number lat", () => {
      const positions = [{ lat: "42.6977" as any, lng: 23.3219 }];
      expect(() => jitterDuplicatePositions(positions)).toThrow(
        "Invalid position: lat and lng must be finite numbers",
      );
    });

    it("should throw error for invalid position with NaN", () => {
      const positions = [{ lat: NaN, lng: 23.3219 }];
      expect(() => jitterDuplicatePositions(positions)).toThrow(
        "Invalid position: lat and lng must be finite numbers",
      );
    });

    it("should throw error for invalid position with Infinity", () => {
      const positions = [{ lat: 42.6977, lng: Infinity }];
      expect(() => jitterDuplicatePositions(positions)).toThrow(
        "Invalid position: lat and lng must be finite numbers",
      );
    });

    it("should preserve additional properties", () => {
      interface CustomPosition {
        lat: number;
        lng: number;
        messageId: string;
        featureIndex: number;
        isActive: boolean;
      }

      const positions: CustomPosition[] = [
        {
          lat: 42.6977,
          lng: 23.3219,
          messageId: "msg1",
          featureIndex: 0,
          isActive: true,
        },
        {
          lat: 42.6977,
          lng: 23.3219,
          messageId: "msg2",
          featureIndex: 1,
          isActive: false,
        },
      ];

      const result = jitterDuplicatePositions(positions);

      expect(result).toHaveLength(2);
      expect(result[0].messageId).toBe("msg1");
      expect(result[0].featureIndex).toBe(0);
      expect(result[0].isActive).toBe(true);
      expect(result[1].messageId).toBe("msg2");
      expect(result[1].featureIndex).toBe(1);
      expect(result[1].isActive).toBe(false);
    });
  });

  describe("createFeatureKey", () => {
    it("should create valid feature key", () => {
      const result = createFeatureKey("msg123", 0);
      expect(result).toBe("msg123-0");
    });

    it("should handle different message IDs", () => {
      const result = createFeatureKey("message-abc-123", 5);
      expect(result).toBe("message-abc-123-5");
    });

    it("should handle large feature indices", () => {
      const result = createFeatureKey("msg", 999);
      expect(result).toBe("msg-999");
    });

    it("should handle message ID with special characters", () => {
      const result = createFeatureKey("msg_with-special.chars", 0);
      expect(result).toBe("msg_with-special.chars-0");
    });

    it("should throw error for empty message ID", () => {
      expect(() => createFeatureKey("", 0)).toThrow(
        "Invalid messageId: must be a non-empty string",
      );
    });

    it("should throw error for null message ID", () => {
      expect(() => createFeatureKey(null as any, 0)).toThrow(
        "Invalid messageId: must be a non-empty string",
      );
    });

    it("should throw error for undefined message ID", () => {
      expect(() => createFeatureKey(undefined as any, 0)).toThrow(
        "Invalid messageId: must be a non-empty string",
      );
    });

    it("should throw error for non-string message ID", () => {
      expect(() => createFeatureKey(123 as any, 0)).toThrow(
        "Invalid messageId: must be a non-empty string",
      );
    });

    it("should throw error for negative feature index", () => {
      expect(() => createFeatureKey("msg123", -1)).toThrow(
        "Invalid featureIndex: must be a non-negative integer",
      );
    });

    it("should throw error for non-integer feature index", () => {
      expect(() => createFeatureKey("msg123", 1.5)).toThrow(
        "Invalid featureIndex: must be a non-negative integer",
      );
    });

    it("should throw error for NaN feature index", () => {
      expect(() => createFeatureKey("msg123", NaN)).toThrow(
        "Invalid featureIndex: must be a non-negative integer",
      );
    });

    it("should throw error for non-number feature index", () => {
      expect(() => createFeatureKey("msg123", "0" as any)).toThrow(
        "Invalid featureIndex: must be a non-negative integer",
      );
    });
  });

  describe("getFeaturesCentroid", () => {
    it("should calculate centroid for FeatureCollection with multiple features", () => {
      const geoJson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [23.3219, 42.6977], // Sofia center
            },
            properties: {},
          },
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [23.3419, 42.7177], // North-east
            },
            properties: {},
          },
        ],
      } as any;

      const result = getFeaturesCentroid(geoJson);

      expect(result).toBeDefined();
      // Average of the two points
      expect(result!.lat).toBeCloseTo((42.6977 + 42.7177) / 2, 4);
      expect(result!.lng).toBeCloseTo((23.3219 + 23.3419) / 2, 4);
    });

    it("should calculate centroid for FeatureCollection with single feature", () => {
      const geoJson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [23.3219, 42.6977],
            },
            properties: {},
          },
        ],
      } as any;

      const result = getFeaturesCentroid(geoJson);

      expect(result).toEqual({
        lat: 42.6977,
        lng: 23.3219,
      });
    });

    it("should handle FeatureCollection with mixed geometry types", () => {
      const geoJson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [23.3219, 42.6977],
            },
            properties: {},
          },
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [
                [23.3319, 42.7077],
                [23.3419, 42.7177],
              ],
            },
            properties: {},
          },
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [23.3519, 42.7277],
                  [23.3619, 42.7277],
                  [23.3619, 42.7377],
                  [23.3519, 42.7377],
                  [23.3519, 42.7277],
                ],
              ],
            },
            properties: {},
          },
        ],
      } as any;

      const result = getFeaturesCentroid(geoJson);

      expect(result).toBeDefined();
      expect(typeof result!.lat).toBe("number");
      expect(typeof result!.lng).toBe("number");
      // Should be somewhere in the middle of all features
      expect(result!.lat).toBeGreaterThan(42.69);
      expect(result!.lat).toBeLessThan(42.75);
      expect(result!.lng).toBeGreaterThan(23.32);
      expect(result!.lng).toBeLessThan(23.37);
    });

    it("should return null for empty FeatureCollection", () => {
      const geoJson = {
        type: "FeatureCollection",
        features: [],
      } as any;

      const result = getFeaturesCentroid(geoJson);

      expect(result).toBeNull();
    });

    it("should return null for null input", () => {
      const result = getFeaturesCentroid(null);

      expect(result).toBeNull();
    });

    it("should return null for undefined input", () => {
      const result = getFeaturesCentroid(undefined);

      expect(result).toBeNull();
    });

    it("should return null when features property is missing", () => {
      const geoJson = {
        type: "FeatureCollection",
      } as any;

      const result = getFeaturesCentroid(geoJson);

      expect(result).toBeNull();
    });

    it("should return null when all geometries return null centroids", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const geoJson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "MultiPoint", // Unsupported type
              coordinates: [[23.3219, 42.6977]],
            },
            properties: {},
          },
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: null, // Invalid coordinates
            },
            properties: {},
          },
        ],
      } as any;

      const result = getFeaturesCentroid(geoJson);

      expect(result).toBeNull();

      consoleSpy.mockRestore();
    });

    it("should calculate centroid from valid geometries while ignoring invalid ones", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const geoJson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [23.3219, 42.6977], // Valid
            },
            properties: {},
          },
          {
            type: "Feature",
            geometry: {
              type: "MultiPoint", // Unsupported - will return null
              coordinates: [[23.5, 42.8]],
            },
            properties: {},
          },
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [23.3419, 42.7177], // Valid
            },
            properties: {},
          },
        ],
      } as any;

      const result = getFeaturesCentroid(geoJson);

      expect(result).toBeDefined();
      // Should only average the two valid Point geometries
      expect(result!.lat).toBeCloseTo((42.6977 + 42.7177) / 2, 4);
      expect(result!.lng).toBeCloseTo((23.3219 + 23.3419) / 2, 4);

      consoleSpy.mockRestore();
    });

    it("should handle features with missing geometry", () => {
      const geoJson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [23.3219, 42.6977],
            },
            properties: {},
          },
          {
            type: "Feature",
            geometry: null,
            properties: {},
          },
          {
            type: "Feature",
            properties: {},
          },
        ],
      } as any;

      const result = getFeaturesCentroid(geoJson);

      expect(result).toBeDefined();
      expect(result!.lat).toBeCloseTo(42.6977, 4);
      expect(result!.lng).toBeCloseTo(23.3219, 4);
    });
  });
});
