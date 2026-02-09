import { describe, it, expect, vi } from "vitest";

// Mock Firebase-dependent imports to avoid initialization errors
vi.mock("./gtfs-geocoding-service", () => ({
  geocodeBusStops: vi.fn(),
}));

vi.mock("./geocoding-service", () => ({
  geocodeAddresses: vi.fn(),
}));

vi.mock("./overpass-geocoding-service", () => ({
  overpassGeocodeAddresses: vi.fn(),
  overpassGeocodeIntersections: vi.fn(),
}));

vi.mock("./cadastre-geocoding-service", () => ({
  geocodeCadastralProperties: vi.fn(),
}));

import { hasHouseNumber } from "./geocoding-router";

describe("hasHouseNumber", () => {
  describe("should detect house numbers with №", () => {
    it("detects number symbol with digits", () => {
      expect(hasHouseNumber("ул. Оборище №111")).toBe(true);
    });

    it("detects number symbol with space before digits", () => {
      expect(hasHouseNumber("сградата с № 65")).toBe(true);
    });

    it("detects number symbol without space", () => {
      expect(hasHouseNumber("№38")).toBe(true);
    });

    it("handles multiple spaces", () => {
      expect(hasHouseNumber("№  42")).toBe(true);
    });
  });

  describe("should detect building numbers with бл.", () => {
    it("detects бл. with space and number", () => {
      expect(hasHouseNumber("бл. №38")).toBe(true);
    });

    it("detects бл. without space before number", () => {
      expect(hasHouseNumber("бл.5")).toBe(true);
    });

    it("detects бл. with space before number", () => {
      expect(hasHouseNumber("бл. 12")).toBe(true);
    });
  });

  describe("should detect building references with 'сградата'", () => {
    it("detects сградата", () => {
      expect(hasHouseNumber("сградата с № 65")).toBe(true);
    });

    it("detects СГРАДАТА (case insensitive)", () => {
      expect(hasHouseNumber("СГРАДАТА")).toBe(true);
    });

    it("detects сГрАдАтА (mixed case)", () => {
      expect(hasHouseNumber("сГрАдАтА")).toBe(true);
    });

    it("detects сградата alone", () => {
      expect(hasHouseNumber("сградата")).toBe(true);
    });
  });

  describe("should handle case insensitivity for бл.", () => {
    it("detects БЛ. (uppercase)", () => {
      expect(hasHouseNumber("БЛ. №38")).toBe(true);
    });

    it("detects Бл. (title case)", () => {
      expect(hasHouseNumber("Бл. 15")).toBe(true);
    });
  });

  describe("should reject non-house-number endpoints", () => {
    it("rejects simple street name", () => {
      expect(hasHouseNumber("ул. Оборище")).toBe(false);
    });

    it("rejects neighborhood name", () => {
      expect(hasHouseNumber("кв. Лозенец")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(hasHouseNumber("")).toBe(false);
    });

    it("rejects cross street", () => {
      expect(hasHouseNumber("ул. Граф Игнатиев")).toBe(false);
    });

    it("rejects number symbol without digits", () => {
      expect(hasHouseNumber("№")).toBe(false);
    });

    it("rejects бл without digits", () => {
      expect(hasHouseNumber("бл.")).toBe(false);
    });

    it("rejects сграда (typo - missing 'та')", () => {
      expect(hasHouseNumber("сграда")).toBe(false);
    });
  });

  describe("should handle complex real-world examples", () => {
    it("detects in compound description", () => {
      expect(hasHouseNumber("ул. Граф Игнатиев №123")).toBe(true);
    });

    it("detects multiple indicators", () => {
      expect(hasHouseNumber("бл. 5 №123")).toBe(true);
    });

    it("rejects when number is part of street name", () => {
      expect(hasHouseNumber("ул. 6-ти септември")).toBe(false);
    });
  });
});
