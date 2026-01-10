import { describe, it, expect } from "vitest";
import {
  SOFIA_BOUNDS,
  SOFIA_CENTER,
  SOFIA_BBOX,
  isWithinSofia,
  isSofiaCenterFallback,
  isGenericCityAddress,
} from "./geocoding-utils";

describe("geocoding-utils", () => {
  describe("constants", () => {
    it("should have correct Sofia bounds", () => {
      expect(SOFIA_BOUNDS).toEqual({
        south: 42.605,
        west: 23.188,
        north: 42.83,
        east: 23.528,
      });
    });

    it("should have Sofia center coordinates", () => {
      expect(SOFIA_CENTER).toEqual({ lat: 42.6977, lng: 23.3219 });
    });

    it("should format SOFIA_BBOX correctly", () => {
      expect(SOFIA_BBOX).toBe("42.605,23.188,42.83,23.528");
    });

    it("should have Sofia center within Sofia bounds", () => {
      expect(isWithinSofia(SOFIA_CENTER.lat, SOFIA_CENTER.lng)).toBe(true);
    });
  });

  describe("isWithinSofia", () => {
    it("should return true for coordinates within Sofia", () => {
      // Sofia city center (Oborishte district)
      expect(isWithinSofia(42.6977, 23.3219)).toBe(true);

      // NDK (National Palace of Culture)
      expect(isWithinSofia(42.6847, 23.3188)).toBe(true);

      // Sofia Airport
      expect(isWithinSofia(42.695, 23.411)).toBe(true);
    });

    it("should return true for coordinates on the boundary", () => {
      // Southwest corner
      expect(isWithinSofia(SOFIA_BOUNDS.south, SOFIA_BOUNDS.west)).toBe(true);

      // Northeast corner
      expect(isWithinSofia(SOFIA_BOUNDS.north, SOFIA_BOUNDS.east)).toBe(true);

      // Northwest corner
      expect(isWithinSofia(SOFIA_BOUNDS.north, SOFIA_BOUNDS.west)).toBe(true);

      // Southeast corner
      expect(isWithinSofia(SOFIA_BOUNDS.south, SOFIA_BOUNDS.east)).toBe(true);
    });

    it("should return false for coordinates outside Sofia", () => {
      // Plovdiv
      expect(isWithinSofia(42.1354, 24.7453)).toBe(false);

      // Varna
      expect(isWithinSofia(43.2141, 27.9147)).toBe(false);

      // London
      expect(isWithinSofia(51.5074, -0.1278)).toBe(false);
    });

    it("should return false for coordinates just outside bounds", () => {
      // Just south of Sofia
      expect(isWithinSofia(SOFIA_BOUNDS.south - 0.001, 23.3)).toBe(false);

      // Just north of Sofia
      expect(isWithinSofia(SOFIA_BOUNDS.north + 0.001, 23.3)).toBe(false);

      // Just west of Sofia
      expect(isWithinSofia(42.7, SOFIA_BOUNDS.west - 0.001)).toBe(false);

      // Just east of Sofia
      expect(isWithinSofia(42.7, SOFIA_BOUNDS.east + 0.001)).toBe(false);
    });

    it("should handle edge cases", () => {
      // Zero coordinates
      expect(isWithinSofia(0, 0)).toBe(false);

      // Negative coordinates (valid for some locations)
      expect(isWithinSofia(-42.7, -23.3)).toBe(false);

      // Very large coordinates
      expect(isWithinSofia(90, 180)).toBe(false);
      expect(isWithinSofia(-90, -180)).toBe(false);
    });
  });

  describe("isSofiaCenterFallback", () => {
    it("should return true for exact Sofia center coordinates", () => {
      expect(isSofiaCenterFallback(SOFIA_CENTER.lat, SOFIA_CENTER.lng)).toBe(
        true
      );
    });

    it("should return true for coordinates that round to Sofia center", () => {
      // Coordinates within rounding precision (4 decimal places)
      expect(isSofiaCenterFallback(42.69771, 23.32191)).toBe(true);
      expect(isSofiaCenterFallback(42.69769, 23.32189)).toBe(true);
    });

    it("should return false for coordinates that don't round to center", () => {
      // Just outside rounding range
      expect(isSofiaCenterFallback(42.69775, 23.32195)).toBe(false);
      expect(isSofiaCenterFallback(42.6976, 23.3218)).toBe(false);

      // NDK is far away
      expect(isSofiaCenterFallback(42.6847, 23.3188)).toBe(false);

      // Oborishte district
      expect(isSofiaCenterFallback(42.6995, 23.3219)).toBe(false);
    });

    it("should detect the exact problematic coordinates from the bug report", () => {
      // These coordinates (42.697708, 23.321867) round to Sofia center
      expect(isSofiaCenterFallback(42.697708, 23.321867)).toBe(true);
    });
  });

  describe("isGenericCityAddress", () => {
    it("should detect generic Sofia addresses in English", () => {
      expect(isGenericCityAddress("Sofia, Bulgaria")).toBe(true);
      expect(isGenericCityAddress("Sofia,Bulgaria")).toBe(true);
      expect(isGenericCityAddress("Sofia")).toBe(true);
    });

    it("should detect generic Sofia addresses in Bulgarian", () => {
      expect(isGenericCityAddress("София, България")).toBe(true);
      expect(isGenericCityAddress("София,България")).toBe(true);
      expect(isGenericCityAddress("София")).toBe(true);
    });

    it("should be case insensitive", () => {
      expect(isGenericCityAddress("SOFIA, BULGARIA")).toBe(true);
      expect(isGenericCityAddress("sofia, bulgaria")).toBe(true);
      expect(isGenericCityAddress("СОФИЯ, БЪЛГАРИЯ")).toBe(true);
    });

    it("should not flag specific addresses in Sofia", () => {
      expect(isGenericCityAddress("ул. Врабча 1, София, България")).toBe(false);
      expect(isGenericCityAddress("бул. Витоша 1, 1000 София, Bulgaria")).toBe(
        false
      );
      expect(isGenericCityAddress("NDK, Sofia, Bulgaria")).toBe(false);
      expect(isGenericCityAddress("Sofia Airport, Bulgaria")).toBe(false);
    });

    it("should not flag addresses outside Sofia", () => {
      expect(isGenericCityAddress("Plovdiv, Bulgaria")).toBe(false);
      expect(isGenericCityAddress("Varna, Bulgaria")).toBe(false);
    });
  });
});
