/**
 * Integration tests for the new geocoding system.
 *
 * Tests the provider chain logic: multiple providers per entity type,
 * each tried in sequence until first success, with done() callback invocation.
 */

import { describe, it, expect, vi } from "vitest";
import { geocode } from "./geocode";
import type { GeocodingContext, GeocodingProviders, PinResult, StreetResult } from "./interfaces";

// Mock providers for testing the provider chain
class MockPinGeocoder1 {
  async geocodePin(): Promise<PinResult | null> {
    return null; // First provider returns null, should try next
  }
}

class MockPinGeocoder2 {
  done = vi.fn().mockResolvedValue(undefined);

  async geocodePin(): Promise<PinResult | null> {
    return {
      address: {
        originalText: "test address",
        formattedAddress: "Test Address, Sofia",
        coordinates: { lat: 42.6977, lng: 23.3219 },
      },
    };
  }
}

class MockStreetGeocoder {
  done = vi.fn().mockResolvedValue(undefined);

  async geocodeStreet(): Promise<StreetResult | null> {
    return {
      fromCoordinates: { lat: 42.6977, lng: 23.3219 },
      toCoordinates: { lat: 42.6979, lng: 23.3221 },
      qualitySignals: {
        provider: "street",
        geometryQuality: 2,
      },
    };
  }
}

describe("geocoding system integration", () => {
  let context: GeocodingContext;
  let providers: GeocodingProviders;

  it("should skip first pin provider that returns null and use second provider", async () => {
    const pinGeocoder1 = new MockPinGeocoder1();
    const pinGeocoder2 = new MockPinGeocoder2();

    context = {
      locality: "sofia",
      extractedLocations: {
        pins: [{ address: "ул. Оборище №1", timespans: [{ start: null, end: null }] }],
        streets: [],
        cadastralProperties: [],
        busStops: [],
        educationalFacilities: [],
      },
    };

    providers = {
      pin: [pinGeocoder1, pinGeocoder2],
      street: [],
      cadastral: [],
      busStop: [],
      educationalFacility: [],
    };

    const result = await geocode(context, providers);

    // Should have one address from the second geocoder
    expect(result.addresses).toHaveLength(1);
    expect(result.addresses[0].originalText).toBe("test address");
  });

  it("should call done() callback on all providers after processing streets", async () => {
    const streetGeocoder = new MockStreetGeocoder();

    context = {
      locality: "sofia",
      extractedLocations: {
        pins: [],
        streets: [
          {
            street: "ул. Оборище",
            from: "ул. Ломско",
            to: "пл. Александър Батенберг",
            timespans: [{ start: null, end: null }],
          },
        ],
        cadastralProperties: [],
        busStops: [],
        educationalFacilities: [],
      },
    };

    providers = {
      pin: [],
      street: [streetGeocoder],
      cadastral: [],
      busStop: [],
      educationalFacility: [],
    };

    await geocode(context, providers);

    // Street geocoder's done() should have been called with results map
    expect(streetGeocoder.done).toHaveBeenCalledTimes(1);
    const [resultsMap] = streetGeocoder.done.mock.calls[0];
    expect(resultsMap).toBeInstanceOf(Map);
    expect(resultsMap.size).toBe(1);
  });

  it("should handle empty locations gracefully", async () => {
    context = {
      locality: "sofia",
      extractedLocations: {
        pins: [],
        streets: [],
        cadastralProperties: [],
        busStops: [],
        educationalFacilities: [],
      },
    };

    providers = {
      pin: [],
      street: [],
      cadastral: [],
      busStop: [],
      educationalFacility: [],
    };

    const result = await geocode(context, providers);

    expect(result.addresses).toHaveLength(0);
    expect(result.qualityMap.size).toBe(0);
  });

  it("should store street quality signals in qualityMap", async () => {
    const streetGeocoder = new MockStreetGeocoder();

    context = {
      locality: "sofia",
      extractedLocations: {
        pins: [],
        streets: [
          {
            street: "ул. Оборище",
            from: "ул. Ломско",
            to: "пл. Александър Батенберг",
            timespans: [{ start: null, end: null }],
          },
        ],
        cadastralProperties: [],
        busStops: [],
        educationalFacilities: [],
      },
    };

    providers = {
      pin: [],
      street: [streetGeocoder],
      cadastral: [],
      busStop: [],
      educationalFacility: [],
    };

    const result = await geocode(context, providers);

    // Quality signals should be in qualityMap keyed by street|from|to
    const key = "ул. Оборище|ул. Ломско|пл. Александър Батенберг";
    expect(result.qualityMap.has(key)).toBe(true);

    const quality = result.qualityMap.get(key)!;
    expect(quality.provider).toBe("street");
    expect(quality.geometryQuality).toBe(2);
  });

  it("should try multiple providers in order and stop at first success", async () => {
    const provider1 = {
      async geocodeStreet() {
        return null; // Return null to try next provider
      },
    };

    const provider2 = new MockStreetGeocoder();

    context = {
      locality: "sofia",
      extractedLocations: {
        pins: [],
        streets: [
          {
            street: "ул. Оборище",
            from: "ул. Ломско",
            to: "пл. Александър Батенберг",
            timespans: [{ start: null, end: null }],
          },
        ],
        cadastralProperties: [],
        busStops: [],
        educationalFacilities: [],
      },
    };

    providers = {
      pin: [],
      street: [provider1 as any, provider2],
      cadastral: [],
      busStop: [],
      educationalFacility: [],
    };

    const result = await geocode(context, providers);

    // Should use second provider's result
    const key = "ул. Оборище|ул. Ломско|пл. Александър Батенберг";
    expect(result.qualityMap.has(key)).toBe(true);
    const quality = result.qualityMap.get(key)!;
    expect(quality.provider).toBe("street");
  });
});
