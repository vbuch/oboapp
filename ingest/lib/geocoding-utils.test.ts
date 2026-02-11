import { describe, it, expect, beforeEach } from "vitest";
import {
  getTargetBounds,
  getTargetCenter,
  getTargetBbox,
  isCenterFallback,
  isGenericCityAddress,
} from "./geocoding-utils";
import { BOUNDS, CENTERS } from "./bounds";

// Set TARGET_CITY for tests
beforeEach(() => {
  process.env.TARGET_CITY = "bg.sofia";
});

describe("geocoding-utils", () => {
  describe("getTarget functions", () => {
    it("should get correct bounds for Sofia", () => {
      expect(getTargetBounds()).toEqual(BOUNDS["bg.sofia"]);
    });

    it("should get correct center for Sofia", () => {
      expect(getTargetCenter()).toEqual(CENTERS["bg.sofia"]);
    });

    it("should format bbox correctly for Sofia", () => {
      expect(getTargetBbox()).toBe("42.605,23.188,42.83,23.528");
    });
  });

  describe("isCenterFallback", () => {
    const SOFIA_CENTER = CENTERS["bg.sofia"];

    it("should return true for exact Sofia center coordinates", () => {
      expect(isCenterFallback(SOFIA_CENTER.lat, SOFIA_CENTER.lng)).toBe(
        true
      );
    });

    it("should return true for coordinates that round to Sofia center", () => {
      // Coordinates within rounding precision (4 decimal places)
      expect(isCenterFallback(42.69771, 23.32191)).toBe(true);
      expect(isCenterFallback(42.69769, 23.32189)).toBe(true);
    });

    it("should return false for coordinates that don't round to center", () => {
      // Just outside rounding range
      expect(isCenterFallback(42.69775, 23.32195)).toBe(false);
      expect(isCenterFallback(42.6976, 23.3218)).toBe(false);

      // NDK is far away
      expect(isCenterFallback(42.6847, 23.3188)).toBe(false);

      // Oborishte district
      expect(isCenterFallback(42.6995, 23.3219)).toBe(false);
    });

    it("should detect the exact problematic coordinates from the bug report", () => {
      // These coordinates (42.697708, 23.321867) round to Sofia center
      expect(isCenterFallback(42.697708, 23.321867)).toBe(true);
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

    it("should detect generic Plovdiv addresses", () => {
      expect(isGenericCityAddress("Plovdiv, Bulgaria")).toBe(true);
      expect(isGenericCityAddress("Plovdiv")).toBe(true);
      expect(isGenericCityAddress("Пловдив, България")).toBe(true);
      expect(isGenericCityAddress("Пловдив")).toBe(true);
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

    it("should not flag addresses outside major cities", () => {
      expect(isGenericCityAddress("Varna, Bulgaria")).toBe(false);
      expect(isGenericCityAddress("Burgas, Bulgaria")).toBe(false);
    });
  });
});

