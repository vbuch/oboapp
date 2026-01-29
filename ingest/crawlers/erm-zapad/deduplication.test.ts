import { describe, it, expect } from "vitest";
import { deduplicatePinRecords } from "./deduplication";
import type { PinRecord } from "./types";

describe("deduplicatePinRecords", () => {
  const createPin = (overrides: Partial<PinRecord>): PinRecord => ({
    lat: 42.700634,
    lon: 23.322667,
    eventId: "SF_7650",
    typedist: "планирано",
    begin_event: "28.01.2026 09:42",
    end_event: "28.01.2026 18:15",
    city_name: "жк.КРАСНО СЕЛО",
    cities: "",
    ...overrides,
  });

  it("should return empty array for empty input", () => {
    const result = deduplicatePinRecords([]);
    expect(result).toEqual([]);
  });

  it("should return single pin unchanged", () => {
    const pin = createPin({});
    const result = deduplicatePinRecords([pin]);
    expect(result).toEqual([pin]);
  });

  it("should not deduplicate pins with different coordinates", () => {
    const pins = [
      createPin({ lat: 42.700634, lon: 23.322667, eventId: "SF_0001" }),
      createPin({ lat: 42.700729, lon: 23.323977, eventId: "SF_0002" }),
    ];

    const result = deduplicatePinRecords(pins);
    expect(result).toHaveLength(2);
  });

  it("should not deduplicate pins with different typedist", () => {
    const pins = [
      createPin({ typedist: "планирано", eventId: "SF_0001" }),
      createPin({ typedist: "непланирано", eventId: "SF_0002" }),
    ];

    const result = deduplicatePinRecords(pins);
    expect(result).toHaveLength(2);
  });

  it("should not deduplicate pins with different begin_event", () => {
    const pins = [
      createPin({ begin_event: "28.01.2026 09:00", eventId: "SF_0001" }),
      createPin({ begin_event: "28.01.2026 10:00", eventId: "SF_0002" }),
    ];

    const result = deduplicatePinRecords(pins);
    expect(result).toHaveLength(2);
  });

  it("should not deduplicate pins with different end_event", () => {
    const pins = [
      createPin({ end_event: "28.01.2026 17:00", eventId: "SF_0001" }),
      createPin({ end_event: "28.01.2026 18:00", eventId: "SF_0002" }),
    ];

    const result = deduplicatePinRecords(pins);
    expect(result).toHaveLength(2);
  });

  it("should not deduplicate pins with different city_name", () => {
    const pins = [
      createPin({ city_name: "жк.КРАСНО СЕЛО", eventId: "SF_0001" }),
      createPin({ city_name: "жк.МЛАДОСТ", eventId: "SF_0002" }),
    ];

    const result = deduplicatePinRecords(pins);
    expect(result).toHaveLength(2);
  });

  it("should not deduplicate pins with different cities", () => {
    const pins = [
      createPin({ cities: "София", eventId: "SF_0001" }),
      createPin({ cities: "София, Младост", eventId: "SF_0002" }),
    ];

    const result = deduplicatePinRecords(pins);
    expect(result).toHaveLength(2);
  });

  it("should deduplicate exact duplicates", () => {
    const pin1 = createPin({ eventId: "SF_0001" });
    const pin2 = createPin({ eventId: "SF_0001" });

    const result = deduplicatePinRecords([pin1, pin2]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(pin1);
  });

  it("should keep pin with lowest eventId when all properties match", () => {
    const pins = [
      createPin({ eventId: "SF_0010" }),
      createPin({ eventId: "SF_0001" }),
      createPin({ eventId: "SF_0005" }),
    ];

    const result = deduplicatePinRecords(pins);
    expect(result).toHaveLength(1);
    expect(result[0].eventId).toBe("SF_0001");
  });

  it("should handle alphanumeric sorting correctly", () => {
    const pins = [
      createPin({ eventId: "SF_9999" }),
      createPin({ eventId: "SF_0001" }),
      createPin({ eventId: "SF_1000" }),
      createPin({ eventId: "SF_0100" }),
    ];

    const result = deduplicatePinRecords(pins);
    expect(result).toHaveLength(1);
    // Alphanumeric: "SF_0001" < "SF_0100" < "SF_1000" < "SF_9999"
    expect(result[0].eventId).toBe("SF_0001");
  });

  it("should preserve first occurrence when eventIds are equal", () => {
    const pin1 = createPin({ eventId: "SF_0001" });
    const pin2 = createPin({ eventId: "SF_0001" });
    const pin3 = createPin({ eventId: "SF_0001" });

    // Add a marker to distinguish them
    const markedPin1 = { ...pin1, _marker: "first" };
    const markedPin2 = { ...pin2, _marker: "second" };
    const markedPin3 = { ...pin3, _marker: "third" };

    const result = deduplicatePinRecords([
      markedPin1 as PinRecord,
      markedPin2 as PinRecord,
      markedPin3 as PinRecord,
    ]);

    expect(result).toHaveLength(1);
    expect((result[0] as any)._marker).toBe("first");
  });

  it("should handle multiple distinct groups of duplicates", () => {
    const group1 = [
      createPin({ lat: 42.700634, eventId: "SF_0010" }),
      createPin({ lat: 42.700634, eventId: "SF_0001" }),
    ];

    const group2 = [
      createPin({ lat: 42.700729, eventId: "SF_0020" }),
      createPin({ lat: 42.700729, eventId: "SF_0005" }),
    ];

    const result = deduplicatePinRecords([...group1, ...group2]);
    expect(result).toHaveLength(2);
    expect(result.find((p) => p.lat === 42.700634)?.eventId).toBe("SF_0001");
    expect(result.find((p) => p.lat === 42.700729)?.eventId).toBe("SF_0005");
  });

  it("should handle real-world scenario with 129 customer points", () => {
    // Simulate scenario from incident-129-customer-points.json
    const pins: PinRecord[] = [];
    const basePin = createPin({
      eventId: "SF_7650",
      begin_event: "28.01.2026 09:42",
      end_event: "28.01.2026 18:15",
    });

    // Add some duplicates with different eventIds
    for (let i = 0; i < 5; i++) {
      pins.push({ ...basePin, eventId: `SF_${7650 + i}` });
    }

    // Add some unique pins
    for (let i = 0; i < 10; i++) {
      pins.push({
        ...basePin,
        lat: 42.700634 + i * 0.0001,
        eventId: `SF_${8000 + i}`,
      });
    }

    const result = deduplicatePinRecords(pins);
    expect(result.length).toBeLessThan(pins.length);
    // Should keep SF_7650 (lowest from the duplicate group)
    expect(result.find((p) => p.lat === basePin.lat)?.eventId).toBe("SF_7650");
  });

  it("should handle empty string values consistently", () => {
    const pins = [
      createPin({ cities: "", eventId: "SF_0001" }),
      createPin({ cities: "", eventId: "SF_0002" }),
    ];

    const result = deduplicatePinRecords(pins);
    expect(result).toHaveLength(1);
    expect(result[0].eventId).toBe("SF_0001");
  });

  it("should differentiate between empty string and missing field", () => {
    const pin1 = createPin({ cities: "", eventId: "SF_0001" });
    const pin2 = createPin({ cities: "София", eventId: "SF_0002" });

    const result = deduplicatePinRecords([pin1, pin2]);
    expect(result).toHaveLength(2);
  });

  it("should maintain deduplication across large datasets", () => {
    const pins: PinRecord[] = [];
    const uniqueCount = 100;
    const duplicatesPerUnique = 5;

    for (let i = 0; i < uniqueCount; i++) {
      for (let j = 0; j < duplicatesPerUnique; j++) {
        pins.push(
          createPin({
            lat: 42.700634 + i * 0.0001,
            eventId: `SF_${1000 + i * duplicatesPerUnique + j}`,
          }),
        );
      }
    }

    const result = deduplicatePinRecords(pins);
    expect(result).toHaveLength(uniqueCount);
  });

  it("should handle special characters in string fields", () => {
    const pins = [
      createPin({ city_name: "жк.КРАСНО СЕЛО", eventId: "SF_0001" }),
      createPin({ city_name: "жк.КРАСНО СЕЛО", eventId: "SF_0002" }),
    ];

    const result = deduplicatePinRecords(pins);
    expect(result).toHaveLength(1);
    expect(result[0].eventId).toBe("SF_0001");
  });
});
