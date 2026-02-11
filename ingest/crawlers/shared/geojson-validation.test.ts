import { describe, it, expect } from "vitest";
import {
  validateAndFixGeoJSON,
  isValidCoordinate,
  detectSwappedCoordinates,
  fixSwappedCoordinates,
} from "./geojson-validation";
import { BOUNDS, isWithinBounds } from "@oboapp/shared";

const SOFIA_BOUNDS = BOUNDS["bg.sofia"];

describe("geojson-validation", () => {
  describe("isValidCoordinate", () => {
    it("should accept valid coordinates", () => {
      expect(isValidCoordinate(23.32, 42.7)).toBe(true);
      expect(isValidCoordinate(0, 0)).toBe(true);
      expect(isValidCoordinate(-180, -90)).toBe(true);
      expect(isValidCoordinate(180, 90)).toBe(true);
    });

    it("should reject invalid coordinates", () => {
      expect(isValidCoordinate(181, 42.7)).toBe(false);
      expect(isValidCoordinate(23.32, 91)).toBe(false);
      expect(isValidCoordinate(-181, 0)).toBe(false);
      expect(isValidCoordinate(0, -91)).toBe(false);
      expect(isValidCoordinate(NaN, 42.7)).toBe(false);
      expect(isValidCoordinate(23.32, Infinity)).toBe(false);
    });
  });

  describe("isWithinBounds (with Sofia)", () => {
    it("should accept coordinates within Sofia bounds", () => {
      expect(isWithinBounds("bg.sofia", 42.7, 23.32)).toBe(true);
      expect(isWithinBounds("bg.sofia", 42.698, 23.319)).toBe(true);
      expect(isWithinBounds("bg.sofia", SOFIA_BOUNDS.south, SOFIA_BOUNDS.west)).toBe(true);
      expect(isWithinBounds("bg.sofia", SOFIA_BOUNDS.north, SOFIA_BOUNDS.east)).toBe(true);
    });

    it("should reject coordinates outside Sofia bounds", () => {
      expect(isWithinBounds("bg.sofia", 50.0, 23.32)).toBe(false);
      expect(isWithinBounds("bg.sofia", 42.7, 20.0)).toBe(false);
      expect(isWithinBounds("bg.sofia", 0, 0)).toBe(false);
    });
  });

  describe("detectSwappedCoordinates", () => {
    it("should detect swapped Sofia coordinates", () => {
      // When data has [lat, lng] = [42.7, 23.32] but we think it's [lng, lat]
      // We call detectSwappedCoordinates(42.7, 23.32)
      // Function checks: lng=42.7 is in lat range, lat=23.32 is in lng range
      // and isWithinSofia(42.7, 23.32) is true → coordinates are swapped
      expect(detectSwappedCoordinates(42.7, 23.32)).toBe(true);
    });

    it("should not detect correct coordinates as swapped", () => {
      // Correct format: [lng, lat] = [23.32, 42.7]
      // detectSwappedCoordinates(23.32, 42.7) checks if they're swapped
      // lng=23.32 is NOT in lat range (-90 to 90 but specifically -90 to 90),
      // Actually 23.32 IS in lat range, so we need different coords
      // Let's use coordinates that are clearly correct
      expect(detectSwappedCoordinates(23.32, 42.7)).toBe(false);
    });

    it("should not detect coordinates outside Sofia as swapped", () => {
      expect(detectSwappedCoordinates(51.5, -0.1)).toBe(false); // London
      expect(detectSwappedCoordinates(-0.1, 51.5)).toBe(false);
    });
  });

  describe("fixSwappedCoordinates", () => {
    it("should swap coordinates", () => {
      expect(fixSwappedCoordinates([23.32, 42.7])).toEqual([42.7, 23.32]);
      expect(fixSwappedCoordinates([1, 2])).toEqual([2, 1]);
    });
  });

  describe("validateAndFixGeoJSON", () => {
    describe("basic validation", () => {
      it("should reject non-object input", () => {
        const result = validateAndFixGeoJSON(null);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("GeoJSON is not an object");
      });

      it("should reject wrong type", () => {
        const result = validateAndFixGeoJSON({ type: "Feature", features: [] });
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('must be "FeatureCollection"');
      });

      it("should reject missing features array", () => {
        const result = validateAndFixGeoJSON({ type: "FeatureCollection" });
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain("features must be an array");
      });

      it("should accept valid empty FeatureCollection", () => {
        const result = validateAndFixGeoJSON({
          type: "FeatureCollection",
          features: [],
        });
        expect(result.isValid).toBe(true);
        expect(result.geoJson?.features).toEqual([]);
      });
    });

    describe("Point geometry validation", () => {
      it("should validate correct Point", () => {
        const input = {
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

        const result = validateAndFixGeoJSON(input);
        expect(result.isValid).toBe(true);
        expect(result.geoJson?.features).toHaveLength(1);
        expect(result.geoJson?.features[0].geometry.type).toBe("Point");
      });

      it("should fix swapped Point coordinates", () => {
        const input = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [42.7, 23.32], // Swapped [lat, lng]
              },
              properties: {},
            },
          ],
        };

        const result = validateAndFixGeoJSON(input, "Test");
        expect(result.isValid).toBe(true);
        expect(result.fixedCoordinates).toBe(true);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain("coordinates swapped");
        const point = result.geoJson?.features[0].geometry as any;
        expect(point.coordinates).toEqual([23.32, 42.7]);
      });

      it("should reject Point with invalid coordinates", () => {
        const input = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [200, 42.7], // Invalid longitude
              },
              properties: {},
            },
          ],
        };

        const result = validateAndFixGeoJSON(input);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain("invalid geometry");
      });

      it("should reject Point with non-array coordinates", () => {
        const input = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: { x: 23.32, y: 42.7 },
              },
              properties: {},
            },
          ],
        };

        const result = validateAndFixGeoJSON(input);
        expect(result.isValid).toBe(false);
      });
    });

    describe("LineString geometry validation", () => {
      it("should validate correct LineString", () => {
        const input = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [23.32, 42.7],
                  [23.33, 42.71],
                  [23.34, 42.72],
                ],
              },
              properties: {},
            },
          ],
        };

        const result = validateAndFixGeoJSON(input);
        expect(result.isValid).toBe(true);
        expect(result.geoJson?.features[0].geometry.type).toBe("LineString");
      });

      it("should fix swapped LineString coordinates", () => {
        const input = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [42.7, 23.32], // Swapped
                  [42.71, 23.33], // Swapped
                ],
              },
              properties: {},
            },
          ],
        };

        const result = validateAndFixGeoJSON(input);
        expect(result.isValid).toBe(true);
        expect(result.fixedCoordinates).toBe(true);
        expect(result.warnings[0]).toContain("coordinates swapped");
        const line = result.geoJson?.features[0].geometry as any;
        expect(line.coordinates).toEqual([
          [23.32, 42.7],
          [23.33, 42.71],
        ]);
      });

      it("should reject LineString with less than 2 points", () => {
        const input = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [[23.32, 42.7]],
              },
              properties: {},
            },
          ],
        };

        const result = validateAndFixGeoJSON(input);
        expect(result.isValid).toBe(false);
      });
    });

    describe("Polygon geometry validation", () => {
      it("should validate correct Polygon", () => {
        const input = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [23.32, 42.7],
                    [23.33, 42.7],
                    [23.33, 42.71],
                    [23.32, 42.71],
                    [23.32, 42.7], // Closed ring
                  ],
                ],
              },
              properties: {},
            },
          ],
        };

        const result = validateAndFixGeoJSON(input);
        expect(result.isValid).toBe(true);
        expect(result.geoJson?.features[0].geometry.type).toBe("Polygon");
      });

      it("should fix swapped Polygon coordinates", () => {
        const input = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [42.7, 23.32], // Swapped
                    [42.7, 23.33],
                    [42.71, 23.33],
                    [42.71, 23.32],
                    [42.7, 23.32],
                  ],
                ],
              },
              properties: {},
            },
          ],
        };

        const result = validateAndFixGeoJSON(input);
        expect(result.isValid).toBe(true);
        expect(result.fixedCoordinates).toBe(true);
        const polygon = result.geoJson?.features[0].geometry as any;
        expect(polygon.coordinates[0][0]).toEqual([23.32, 42.7]);
      });

      it("should reject Polygon with unclosed ring", () => {
        const input = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [23.32, 42.7],
                    [23.33, 42.7],
                    [23.33, 42.71],
                    [23.32, 42.71],
                    // Missing closing point
                  ],
                ],
              },
              properties: {},
            },
          ],
        };

        const result = validateAndFixGeoJSON(input);
        expect(result.isValid).toBe(false);
      });

      it("should reject Polygon with less than 4 points", () => {
        const input = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [23.32, 42.7],
                    [23.33, 42.7],
                    [23.32, 42.7],
                  ],
                ],
              },
              properties: {},
            },
          ],
        };

        const result = validateAndFixGeoJSON(input);
        expect(result.isValid).toBe(false);
      });
    });

    describe("feature validation", () => {
      it("should skip features with wrong type", () => {
        const input = {
          type: "FeatureCollection",
          features: [
            {
              type: "Point", // Wrong type
              geometry: { type: "Point", coordinates: [23.32, 42.7] },
              properties: {},
            },
          ],
        };

        const result = validateAndFixGeoJSON(input);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('type must be "Feature"');
      });

      it("should skip features with missing geometry", () => {
        const input = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
            },
          ],
        };

        const result = validateAndFixGeoJSON(input);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain("missing geometry");
      });

      it("should preserve properties", () => {
        const input = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [23.32, 42.7],
              },
              properties: {
                name: "Test",
                id: 123,
              },
            },
          ],
        };

        const result = validateAndFixGeoJSON(input);
        expect(result.isValid).toBe(true);
        expect(result.geoJson?.features[0].properties).toEqual({
          name: "Test",
          id: 123,
        });
      });

      it("should add context prefix to errors and warnings", () => {
        const input = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [42.7, 23.32], // Swapped
              },
              properties: {},
            },
          ],
        };

        const result = validateAndFixGeoJSON(input, "MySource");
        expect(result.warnings[0]).toContain("[MySource]");
      });
    });

    describe("unsupported geometry types", () => {
      it("should reject MultiPoint", () => {
        const input = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "MultiPoint",
                coordinates: [
                  [23.32, 42.7],
                  [23.33, 42.71],
                ],
              },
              properties: {},
            },
          ],
        };

        const result = validateAndFixGeoJSON(input);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain("invalid geometry");
      });
    });
  });
});
