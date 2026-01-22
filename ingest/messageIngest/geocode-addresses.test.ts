import { describe, it, expect, vi } from "vitest";
import { findMissingStreetEndpoints } from "./geocode-addresses";
import type { StreetSection } from "@/lib/types";

// Mock firebase-admin to avoid requiring env vars
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: vi.fn(),
}));

describe(findMissingStreetEndpoints, () => {
  it("should return empty array when all endpoints are geocoded", () => {
    const streets: StreetSection[] = [
      {
        street: "Main Street",
        from: "Corner A",
        to: "Corner B",
        timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
      },
    ];

    const geocodedMap = new Map([
      ["Corner A", { lat: 42, lng: 23 }],
      ["Corner B", { lat: 42.1, lng: 23.1 }],
    ]);

    const result = findMissingStreetEndpoints(streets, geocodedMap);
    expect(result).toEqual([]);
  });

  it("should return missing from endpoint", () => {
    const streets: StreetSection[] = [
      {
        street: "Main Street",
        from: "Corner A",
        to: "Corner B",
        timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
      },
    ];

    const geocodedMap = new Map([["Corner B", { lat: 42.1, lng: 23.1 }]]);

    const result = findMissingStreetEndpoints(streets, geocodedMap);
    expect(result).toEqual(["Corner A"]);
  });

  it("should return missing to endpoint", () => {
    const streets: StreetSection[] = [
      {
        street: "Main Street",
        from: "Corner A",
        to: "Corner B",
        timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
      },
    ];

    const geocodedMap = new Map([["Corner A", { lat: 42, lng: 23 }]]);

    const result = findMissingStreetEndpoints(streets, geocodedMap);
    expect(result).toEqual(["Corner B"]);
  });

  it("should return both missing endpoints", () => {
    const streets: StreetSection[] = [
      {
        street: "Main Street",
        from: "Corner A",
        to: "Corner B",
        timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
      },
    ];

    const geocodedMap = new Map();

    const result = findMissingStreetEndpoints(streets, geocodedMap);
    expect(result).toEqual(["Corner A", "Corner B"]);
  });

  it("should handle multiple streets", () => {
    const streets: StreetSection[] = [
      {
        street: "Main Street",
        from: "Corner A",
        to: "Corner B",
        timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
      },
      {
        street: "Side Street",
        from: "Corner C",
        to: "Corner D",
        timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
      },
    ];

    const geocodedMap = new Map([
      ["Corner A", { lat: 42, lng: 23 }],
      ["Corner C", { lat: 42.2, lng: 23.2 }],
    ]);

    const result = findMissingStreetEndpoints(streets, geocodedMap);
    expect(result).toEqual(["Corner B", "Corner D"]);
  });

  it("should handle empty streets array", () => {
    const streets: StreetSection[] = [];
    const geocodedMap = new Map();

    const result = findMissingStreetEndpoints(streets, geocodedMap);
    expect(result).toEqual([]);
  });

  it("should handle streets with same endpoints", () => {
    const streets: StreetSection[] = [
      {
        street: "Main Street",
        from: "Corner A",
        to: "Corner B",
        timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
      },
      {
        street: "Side Street",
        from: "Corner A",
        to: "Corner C",
        timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
      },
    ];

    const geocodedMap = new Map([["Corner A", { lat: 42, lng: 23 }]]);

    const result = findMissingStreetEndpoints(streets, geocodedMap);
    // Should include duplicates as they're processed per street
    expect(result).toEqual(["Corner B", "Corner C"]);
  });
});
