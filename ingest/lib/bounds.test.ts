import { describe, it, expect } from "vitest";
import { BOUNDS, getBboxForLocality, isWithinBounds } from "@oboapp/shared";

const SOFIA_BOUNDS = BOUNDS["bg.sofia"];

describe("bounds", () => {
  describe("BOUNDS registry", () => {
    it("should have correct Sofia boundaries", () => {
      expect(SOFIA_BOUNDS).toEqual({
        south: 42.605,
        west: 23.188,
        north: 42.83,
        east: 23.528,
      });
    });

    it("should get bounds for locality", () => {
      expect(BOUNDS["bg.sofia"]).toEqual(SOFIA_BOUNDS);
    });
  });

  describe("getBboxForLocality", () => {
    it("should format bounds as bbox string", () => {
      expect(getBboxForLocality("bg.sofia")).toBe("42.605,23.188,42.83,23.528");
    });

    it("should throw for invalid locality", () => {
      expect(() => getBboxForLocality("invalid")).toThrow("Unknown locality");
    });
  });

  describe("isWithinBounds", () => {
    it("should return true for Sofia center", () => {
      expect(isWithinBounds("bg.sofia", 42.6977, 23.3219)).toBe(true);
    });

    it("should return true for coordinates within Sofia", () => {
      expect(isWithinBounds("bg.sofia", 42.7, 23.3)).toBe(true);
    });

    it("should return true for southwest corner", () => {
      expect(isWithinBounds("bg.sofia", SOFIA_BOUNDS.south, SOFIA_BOUNDS.west)).toBe(true);
    });

    it("should return true for northeast corner", () => {
      expect(isWithinBounds("bg.sofia", SOFIA_BOUNDS.north, SOFIA_BOUNDS.east)).toBe(true);
    });

    it("should return true for northwest corner", () => {
      expect(isWithinBounds("bg.sofia", SOFIA_BOUNDS.north, SOFIA_BOUNDS.west)).toBe(true);
    });

    it("should return true for southeast corner", () => {
      expect(isWithinBounds("bg.sofia", SOFIA_BOUNDS.south, SOFIA_BOUNDS.east)).toBe(true);
    });

    it("should return false for coordinates outside Sofia (too far north)", () => {
      expect(isWithinBounds("bg.sofia", 43.0, 23.3)).toBe(false);
    });

    it("should return false for coordinates outside Sofia (too far south)", () => {
      expect(isWithinBounds("bg.sofia", 42.5, 23.3)).toBe(false);
    });

    it("should return false for coordinates outside Sofia (too far east)", () => {
      expect(isWithinBounds("bg.sofia", 42.7, 23.6)).toBe(false);
    });

    it("should return false for coordinates outside Sofia (too far west)", () => {
      expect(isWithinBounds("bg.sofia", 42.7, 23.1)).toBe(false);
    });

    it("should return false for coordinates completely outside Sofia", () => {
      expect(isWithinBounds("bg.sofia", 45.0, 25.0)).toBe(false);
    });

    it("should throw for invalid locality", () => {
      expect(() => isWithinBounds("invalid", 42.7, 23.3)).toThrow("Unknown locality");
    });
  });
});
