import { describe, expect, it } from "vitest";
import type { PinRecord } from "./types";
import { buildGeoJSON, buildMessage, buildTitle } from "./builders";

describe("buildMessage", () => {
  it("should build complete message with all fields", () => {
    const pin: PinRecord = {
      lat: 42.700634,
      lon: 23.322667,
      eventId: "SF_7650",
      typedist: "Планирано прекъсване",
      city_name: "София",
      begin_event: "29.12.2025 10:00",
      end_event: "29.12.2025 16:00",
      cities: "",
    };

    const message = buildMessage(pin);

    expect(message).toContain("**Планирано прекъсване**");
    expect(message).toContain("**Населено място:** София");
    expect(message).toContain("**Начало:** 29.12.2025 10:00");
    expect(message).toContain("**Край:** 29.12.2025 16:00");
    expect(message).toContain("**Мрежов код:** SF_7650");
  });

  it("should build message without optional fields", () => {
    const pin: PinRecord = {
      lat: 42.6977,
      lon: 23.3219,
      eventId: "SF_1234",
      typedist: "Авария",
      city_name: "",
      begin_event: "",
      end_event: "",
      cities: "",
    };

    const message = buildMessage(pin);

    expect(message).toContain("**Авария**");
    expect(message).not.toContain("**Населено място:**");
    expect(message).not.toContain("**Начало:**");
    expect(message).not.toContain("**Край:**");
    expect(message).toContain("**Мрежов код:** SF_1234");
  });

  it("should build message with only start date", () => {
    const pin: PinRecord = {
      lat: 42.6977,
      lon: 23.3219,
      eventId: "SF_5678",
      typedist: "Авария",
      city_name: "София",
      begin_event: "29.12.2025 10:00",
      end_event: "",
      cities: "",
    };

    const message = buildMessage(pin);

    expect(message).toContain("**Начало:** 29.12.2025 10:00");
    expect(message).not.toContain("**Край:**");
  });

  it("should preserve newlines and formatting", () => {
    const pin: PinRecord = {
      lat: 42.6977,
      lon: 23.3219,
      eventId: "SF_9999",
      typedist: "Планирано прекъсване",
      city_name: "София",
      begin_event: "29.12.2025 10:00",
      end_event: "29.12.2025 16:00",
      cities: "",
    };

    const message = buildMessage(pin);
    const lines = message.split("\n");

    expect(lines[0]).toBe("**Планирано прекъсване**");
    expect(lines[1]).toBe("");
    expect(lines[2]).toBe("**Населено място:** София");
  });
});

describe("buildTitle", () => {
  it("should build title with all components", () => {
    const pin: PinRecord = {
      lat: 42.700634,
      lon: 23.322667,
      eventId: "SF_7650",
      typedist: "Планирано прекъсване",
      city_name: "жк.КРАСНО СЕЛО",
      begin_event: "28.01.2026 09:42",
      end_event: "28.01.2026 18:15",
      cities: "",
    };

    const title = buildTitle(pin);

    expect(title).toBe("Планирано прекъсване - жк.КРАСНО СЕЛО - SF_7650");
  });

  it("should build title without city", () => {
    const pin: PinRecord = {
      lat: 42.6977,
      lon: 23.3219,
      eventId: "SF_1234",
      typedist: "Авария",
      city_name: "",
      begin_event: "28.01.2026 09:42",
      end_event: "28.01.2026 18:15",
      cities: "",
    };

    const title = buildTitle(pin);

    expect(title).toBe("Авария - SF_1234");
  });

  it("should build title without eventId", () => {
    const pin: PinRecord = {
      lat: 42.6977,
      lon: 23.3219,
      eventId: "",
      typedist: "Планирано прекъсване",
      city_name: "София",
      begin_event: "28.01.2026 09:42",
      end_event: "28.01.2026 18:15",
      cities: "",
    };

    const title = buildTitle(pin);

    expect(title).toBe("Планирано прекъсване - София");
  });
});

describe("buildGeoJSON", () => {
  it("should create FeatureCollection with Point geometry for single pin", () => {
    const pins: PinRecord[] = [
      {
        lat: 42.700634,
        lon: 23.322667,
        eventId: "SF_7650",
        typedist: "планирано",
        city_name: "жк.КРАСНО СЕЛО",
        begin_event: "28.01.2026 09:42",
        end_event: "28.01.2026 18:15",
        cities: "",
      },
    ];

    const result = buildGeoJSON(pins);

    expect(result).toBeDefined();
    expect(result?.type).toBe("FeatureCollection");
    expect(result?.features).toHaveLength(1);
    expect(result?.features[0].geometry.type).toBe("Point");
    expect(result?.features[0].geometry.coordinates).toEqual([
      23.322667, 42.700634,
    ]);
    expect(result?.features[0].properties.eventId).toBe("SF_7650");
  });

  it("should create separate Point features for multiple pins", () => {
    const pins: PinRecord[] = [
      {
        lat: 42.700634,
        lon: 23.322667,
        eventId: "SF_7650",
        typedist: "планирано",
        city_name: "жк.КРАСНО СЕЛО",
        begin_event: "28.01.2026 09:42",
        end_event: "28.01.2026 18:15",
        cities: "",
      },
      {
        lat: 42.700729,
        lon: 23.323977,
        eventId: "SF_7650",
        typedist: "планирано",
        city_name: "жк.КРАСНО СЕЛО",
        begin_event: "28.01.2026 09:42",
        end_event: "28.01.2026 18:15",
        cities: "",
      },
    ];

    const result = buildGeoJSON(pins);

    expect(result).toBeDefined();
    expect(result?.features).toHaveLength(2);
    expect(result?.features[0].geometry.type).toBe("Point");
    expect(result?.features[1].geometry.type).toBe("Point");
    expect(result?.features[0].geometry.coordinates).toEqual([
      23.322667, 42.700634,
    ]);
    expect(result?.features[1].geometry.coordinates).toEqual([
      23.323977, 42.700729,
    ]);
  });

  it("should return null for empty pin array", () => {
    const result = buildGeoJSON([]);

    expect(result).toBeNull();
  });

  it("should include all properties in feature", () => {
    const pins: PinRecord[] = [
      {
        lat: 42.700634,
        lon: 23.322667,
        eventId: "SF_7650",
        typedist: "непланирано",
        city_name: "София",
        begin_event: "28.01.2026 09:42",
        end_event: "28.01.2026 18:15",
        cities: "София",
      },
    ];

    const result = buildGeoJSON(pins);

    expect(result?.features[0].properties).toEqual({
      eventId: "SF_7650",
      cityName: "София",
      eventType: "непланирано",
      startTime: "28.01.2026 09:42",
      endTime: "28.01.2026 18:15",
    });
  });
});
