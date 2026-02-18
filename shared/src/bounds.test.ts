import { describe, it, expect } from "vitest";
import {
  BOUNDS,
  CENTERS,
  LOCALITY_METADATA,
  getBoundsForLocality,
  getCenterForLocality,
  getLocalityMetadata,
  getLocalityName,
  getLocalityDescription,
  getBboxForLocality,
  isWithinBounds,
  validateLocality,
} from "./bounds";

describe("bounds", () => {
  describe("BOUNDS registry", () => {
    it("should have Sofia boundaries", () => {
      expect(BOUNDS["bg.sofia"]).toEqual({
        south: 42.605,
        west: 23.188,
        north: 42.83,
        east: 23.528,
      });
    });
  });

  describe("CENTERS registry", () => {
    it("should have Sofia center", () => {
      expect(CENTERS["bg.sofia"]).toEqual({
        lat: 42.6977,
        lng: 23.3219,
      });
    });
  });

  describe("LOCALITY_METADATA registry", () => {
    it("should have Sofia metadata", () => {
      expect(LOCALITY_METADATA["bg.sofia"]).toMatchObject({
        name: "София",
        nameEn: "Sofia",
        country: "bg",
        description: "Следи събитията в София",
      });
    });
  });

  describe("getLocalityMetadata", () => {
    it("should return metadata for Sofia", () => {
      const metadata = getLocalityMetadata("bg.sofia");
      expect(metadata.name).toBe("София");
      expect(metadata.nameEn).toBe("Sofia");
      expect(metadata.country).toBe("bg");
    });

    it("should throw for unknown locality", () => {
      expect(() => getLocalityMetadata("invalid")).toThrow("Unknown locality");
    });
  });

  describe("getLocalityName", () => {
    it("should return display name for Sofia", () => {
      expect(getLocalityName("bg.sofia")).toBe("София");
    });

    it("should throw for unknown locality", () => {
      expect(() => getLocalityName("invalid")).toThrow("Unknown locality");
    });
  });

  describe("getLocalityDescription", () => {
    it("should return description for Sofia", () => {
      expect(getLocalityDescription("bg.sofia")).toBe("Следи събитията в София");
    });

    it("should throw for unknown locality", () => {
      expect(() => getLocalityDescription("invalid")).toThrow("Unknown locality");
    });
  });

  describe("getBoundsForLocality", () => {
    it("should return bounds for Sofia", () => {
      expect(getBoundsForLocality("bg.sofia")).toEqual(BOUNDS["bg.sofia"]);
    });

    it("should throw for unknown locality", () => {
      expect(() => getBoundsForLocality("invalid")).toThrow("Unknown locality");
    });
  });

  describe("getCenterForLocality", () => {
    it("should return center for Sofia", () => {
      expect(getCenterForLocality("bg.sofia")).toEqual(CENTERS["bg.sofia"]);
    });

    it("should throw for unknown locality", () => {
      expect(() => getCenterForLocality("invalid")).toThrow("Unknown locality");
    });
  });

  describe("getBboxForLocality", () => {
    it("should format bounds as bbox string for Sofia", () => {
      expect(getBboxForLocality("bg.sofia")).toBe("42.605,23.188,42.83,23.528");
    });

    it("should throw for unknown locality", () => {
      expect(() => getBboxForLocality("invalid")).toThrow("Unknown locality");
    });
  });

  describe("isWithinBounds", () => {
    it("should return true for coordinates within Sofia", () => {
      expect(isWithinBounds("bg.sofia", 42.6977, 23.3219)).toBe(true);
      expect(isWithinBounds("bg.sofia", 42.7, 23.3)).toBe(true);
    });

    it("should return false for coordinates outside Sofia", () => {
      expect(isWithinBounds("bg.sofia", 45.0, 25.0)).toBe(false);
      expect(isWithinBounds("bg.sofia", 0, 0)).toBe(false);
    });

    it("should throw for unknown locality", () => {
      expect(() => isWithinBounds("invalid", 42.7, 23.3)).toThrow("Unknown locality");
    });
  });

  describe("validateLocality", () => {
    it("should not throw for valid locality", () => {
      expect(() => validateLocality("bg.sofia")).not.toThrow();
    });

    it("should throw for invalid locality", () => {
      expect(() => validateLocality("invalid")).toThrow("Invalid locality");
    });
  });
});
