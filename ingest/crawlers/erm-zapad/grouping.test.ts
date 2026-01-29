import { describe, it, expect } from "vitest";
import { groupPinsByEventId } from "./grouping";
import type { PinRecord } from "./types";

describe("groupPinsByEventId", () => {
  const createPin = (eventId: string, lat: number, lon: number): PinRecord => ({
    lat,
    lon,
    eventId,
    typedist: "непланирано",
    begin_event: "29.01.2026 10:00",
    end_event: "29.01.2026 14:00",
    city_name: "София",
    cities: "",
  });

  it("should group pins with same eventId", () => {
    const pins: PinRecord[] = [
      createPin("SF_1234", 42.6977, 23.3219),
      createPin("SF_1234", 42.6978, 23.322),
      createPin("SF_5678", 42.6979, 23.3221),
    ];

    const result = groupPinsByEventId(pins);

    expect(result.size).toBe(2);
    expect(result.get("SF_1234")).toHaveLength(2);
    expect(result.get("SF_5678")).toHaveLength(1);
  });

  it("should handle single pin per incident", () => {
    const pins: PinRecord[] = [
      createPin("SF_1234", 42.6977, 23.3219),
      createPin("SF_5678", 42.6978, 23.322),
    ];

    const result = groupPinsByEventId(pins);

    expect(result.size).toBe(2);
    expect(result.get("SF_1234")).toHaveLength(1);
    expect(result.get("SF_5678")).toHaveLength(1);
  });

  it("should handle empty array", () => {
    const result = groupPinsByEventId([]);

    expect(result.size).toBe(0);
  });

  it("should preserve pin order within each group", () => {
    const pins: PinRecord[] = [
      createPin("SF_1234", 42.6977, 23.3219),
      createPin("SF_1234", 42.6978, 23.322),
      createPin("SF_1234", 42.6979, 23.3221),
    ];

    const result = groupPinsByEventId(pins);
    const group = result.get("SF_1234")!;

    expect(group[0].lat).toBe(42.6977);
    expect(group[1].lat).toBe(42.6978);
    expect(group[2].lat).toBe(42.6979);
  });

  it("should handle many pins for same incident", () => {
    const pins: PinRecord[] = Array.from({ length: 10 }, (_, i) =>
      createPin("SF_1234", 42.6977 + i * 0.0001, 23.3219 + i * 0.0001),
    );

    const result = groupPinsByEventId(pins);

    expect(result.size).toBe(1);
    expect(result.get("SF_1234")).toHaveLength(10);
  });

  it("should handle multiple incidents with varying pin counts", () => {
    const pins: PinRecord[] = [
      createPin("SF_1234", 42.6977, 23.3219),
      createPin("SF_1234", 42.6978, 23.322),
      createPin("SF_1234", 42.6979, 23.3221),
      createPin("SF_5678", 42.698, 23.3222),
      createPin("SF_9012", 42.6981, 23.3223),
      createPin("SF_9012", 42.6982, 23.3224),
    ];

    const result = groupPinsByEventId(pins);

    expect(result.size).toBe(3);
    expect(result.get("SF_1234")).toHaveLength(3);
    expect(result.get("SF_5678")).toHaveLength(1);
    expect(result.get("SF_9012")).toHaveLength(2);
  });
});
