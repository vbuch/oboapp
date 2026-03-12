import { describe, it, expect } from "vitest";
import { parseSensorResponse } from "./parse-sensor-response";

function makeSensorEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    sensor: {
      id: 100,
      sensor_type: { name: "SDS011" },
    },
    location: {
      id: 200,
      latitude: "42.700",
      longitude: "23.350",
      indoor: 0,
      ...((overrides.location as Record<string, unknown>) ?? {}),
    },
    timestamp: "2024-01-01T12:00:00",
    sensordatavalues: [
      { value_type: "P1", value: "30.5" },
      { value_type: "P2", value: "15.3" },
    ],
    ...overrides,
    // Re-apply location since overrides may have been spread before it
  };
}

describe("parseSensorResponse", () => {
  it("parses valid sensor entry", () => {
    const result = parseSensorResponse([makeSensorEntry()], "bg.sofia");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sensorId: 100,
      sensorType: "SDS011",
      lat: 42.7,
      lng: 23.35,
      p1: 30, // PM10 truncated to integer
      p2: 15.3, // PM2.5 truncated to 1 decimal
    });
    expect(result[0].timestamp).toBeInstanceOf(Date);
  });

  it("skips indoor sensors", () => {
    const entry = makeSensorEntry({
      location: { id: 200, latitude: "42.700", longitude: "23.350", indoor: 1 },
    });
    const result = parseSensorResponse([entry], "bg.sofia");
    expect(result).toHaveLength(0);
  });

  it("skips entries with null latitude", () => {
    const entry = makeSensorEntry({
      location: { id: 200, latitude: null, longitude: "23.350", indoor: 0 },
    });
    const result = parseSensorResponse([entry], "bg.sofia");
    expect(result).toHaveLength(0);
  });

  it("skips entries with null longitude", () => {
    const entry = makeSensorEntry({
      location: { id: 200, latitude: "42.700", longitude: null, indoor: 0 },
    });
    const result = parseSensorResponse([entry], "bg.sofia");
    expect(result).toHaveLength(0);
  });

  it("skips entries outside locality bounds", () => {
    const entry = makeSensorEntry({
      location: { id: 200, latitude: "41.000", longitude: "23.350", indoor: 0 },
    });
    const result = parseSensorResponse([entry], "bg.sofia");
    expect(result).toHaveLength(0);
  });

  it("skips entries with PM values above hard cap", () => {
    const entry = {
      ...makeSensorEntry(),
      sensordatavalues: [
        { value_type: "P1", value: "1000" },
        { value_type: "P2", value: "15" },
      ],
    };
    const result = parseSensorResponse([entry], "bg.sofia");
    expect(result).toHaveLength(0);
  });

  it("handles non-numeric sensor value strings", () => {
    const entry = {
      ...makeSensorEntry(),
      sensordatavalues: [
        { value_type: "P1", value: "N/A" },
        { value_type: "P2", value: "abc" },
      ],
    };
    const result = parseSensorResponse([entry], "bg.sofia");
    expect(result).toHaveLength(0);
  });

  it("truncates PM2.5 to 1 decimal and PM10 to integer", () => {
    const entry = {
      ...makeSensorEntry(),
      sensordatavalues: [
        { value_type: "P1", value: "45.789" },
        { value_type: "P2", value: "23.456" },
      ],
    };
    const result = parseSensorResponse([entry], "bg.sofia");
    expect(result).toHaveLength(1);
    expect(result[0].p1).toBe(45); // floor to integer
    expect(result[0].p2).toBe(23.4); // floor to 1 decimal
  });

  it("skips entries with invalid timestamp", () => {
    const entry = {
      ...makeSensorEntry(),
      timestamp: "not-a-date",
    };
    const result = parseSensorResponse([entry], "bg.sofia");
    expect(result).toHaveLength(0);
  });

  it("handles empty sensordatavalues array", () => {
    const entry = {
      ...makeSensorEntry(),
      sensordatavalues: [],
    };
    const result = parseSensorResponse([entry], "bg.sofia");
    expect(result).toHaveLength(0);
  });

  it("parses multiple valid entries", () => {
    const entries = [
      makeSensorEntry({ sensor: { id: 100, sensor_type: { name: "SDS011" } } }),
      makeSensorEntry({ sensor: { id: 101, sensor_type: { name: "SDS011" } } }),
    ];
    const result = parseSensorResponse(entries, "bg.sofia");
    expect(result).toHaveLength(2);
  });

  it("handles negative PM values by skipping", () => {
    const entry = {
      ...makeSensorEntry(),
      sensordatavalues: [
        { value_type: "P1", value: "-5" },
        { value_type: "P2", value: "-10" },
      ],
    };
    const result = parseSensorResponse([entry], "bg.sofia");
    expect(result).toHaveLength(0);
  });
});
