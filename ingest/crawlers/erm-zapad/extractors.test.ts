import { describe, expect, it } from "vitest";
import { extractPinRecords } from "./extractors";
import type { RawIncident } from "./types";

describe("extractPinRecords", () => {
  it("should extract center point from incident", () => {
    const incident: RawIncident = {
      ceo: "SF_7650",
      typedist: "планирано",
      type_event: "1",
      city_name: "жк.КРАСНО СЕЛО",
      grid_id: "",
      cities: "",
      begin_event: "28.01.2026 09:42",
      end_event: "28.01.2026 18:15",
      lat: "42.7013091079358",
      lon: "23.3229612178934",
      points: {
        cnt: "72", // Polygon vertices for map visualization
        "1": { lat: "42.700634", lon: "23.322666" },
        // ... more vertices
      },
    };

    const result = extractPinRecords(incident);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      lat: 42.701309,
      lon: 23.322961,
      eventId: "SF_7650",
      typedist: "планирано",
      begin_event: "28.01.2026 09:42",
      end_event: "28.01.2026 18:15",
      city_name: "жк.КРАСНО СЕЛО",
      cities: "",
    });
  });

  it("should round coordinates to 6 decimal places", () => {
    const incident: RawIncident = {
      ceo: "SF_0001",
      typedist: "планирано",
      type_event: "1",
      city_name: "София",
      grid_id: "",
      cities: "",
      begin_event: "28.01.2026 09:42",
      end_event: "28.01.2026 18:15",
      lat: "42.700932123456789",
      lon: "23.323421987654321",
      points: {
        cnt: "0",
      },
    };

    const result = extractPinRecords(incident);

    expect(result).toHaveLength(1);
    expect(result[0].lat).toBe(42.700932);
    expect(result[0].lon).toBe(23.323422);
  });

  it("should handle invalid center coordinates", () => {
    const incident: RawIncident = {
      ceo: "SF_1234",
      typedist: "непланирано",
      type_event: "2",
      city_name: "София",
      grid_id: "",
      cities: "",
      begin_event: "28.01.2026 09:42",
      end_event: "28.01.2026 18:15",
      lat: "invalid",
      lon: "23.3229612178934",
      points: {
        cnt: "0",
      },
    };

    const result = extractPinRecords(incident);

    expect(result).toHaveLength(0);
  });

  it("should handle missing center coordinates", () => {
    const incident: RawIncident = {
      ceo: "SF_5678",
      typedist: "планирано",
      type_event: "1",
      city_name: "София",
      grid_id: "",
      cities: "",
      begin_event: "28.01.2026 09:42",
      end_event: "28.01.2026 18:15",
      lat: "",
      lon: "",
      points: {
        cnt: "0",
      },
    };

    const result = extractPinRecords(incident);

    expect(result).toHaveLength(0);
  });

  it("should preserve all incident metadata", () => {
    const incident: RawIncident = {
      ceo: "SF_9999",
      typedist: "непланирано",
      type_event: "2",
      city_name: "жк.МЛАДОСТ",
      grid_id: "GRID_123",
      cities: "София, Младост",
      begin_event: "29.01.2026 10:00",
      end_event: "29.01.2026 12:00",
      lat: "42.6977",
      lon: "23.3219",
      points: {
        cnt: "5",
      },
    };

    const result = extractPinRecords(incident);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      lat: 42.6977,
      lon: 23.3219,
      eventId: "SF_9999",
      typedist: "непланирано",
      begin_event: "29.01.2026 10:00",
      end_event: "29.01.2026 12:00",
      city_name: "жк.МЛАДОСТ",
      cities: "София, Младост",
    });
  });

  it("should handle real-world incident with many polygon vertices", () => {
    const incident: RawIncident = {
      ceo: "SF_3274",
      typedist: "планирано",
      type_event: "1",
      city_name: "жк.КРАСНО СЕЛО",
      grid_id: "",
      cities: "жк.КРАСНО СЕЛО",
      begin_event: "29.01.2026 13:16",
      end_event: "29.01.2026 15:30",
      lat: "42.6732601426586",
      lon: "23.2893743939152",
      points: {
        cnt: "72", // 72 polygon vertices
        "1": { lat: "42.672009", lon: "23.290932" },
        "2": { lat: "42.67211", lon: "23.290967" },
        // ... 70 more vertices
      },
    };

    const result = extractPinRecords(incident);

    // Should extract only 1 center point, not 72 polygon vertices
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      lat: 42.67326,
      lon: 23.289374,
      eventId: "SF_3274",
      typedist: "планирано",
      begin_event: "29.01.2026 13:16",
      end_event: "29.01.2026 15:30",
      city_name: "жк.КРАСНО СЕЛО",
      cities: "жк.КРАСНО СЕЛО",
    });
  });
});
