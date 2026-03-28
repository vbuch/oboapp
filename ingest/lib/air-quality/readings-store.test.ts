import { describe, it, expect, beforeEach } from "vitest";
import type { ReadingsBackend } from "./readings-store";
import { ReadingsStore } from "./readings-store";
import type { ParsedReading } from "./parse-sensor-response";

/** In-memory backend for testing — avoids FS and GCS. */
class MemoryBackend implements ReadingsBackend {
  store = new Map<string, Array<{ sensorId: number; sensorType: string; timestamp: string; lat: number; lng: number; p1: number; p2: number }>>();

  async read(locality: string) {
    return this.store.get(locality) ?? null;
  }

  async write(locality: string, readings: Array<{ sensorId: number; sensorType: string; timestamp: string; lat: number; lng: number; p1: number; p2: number }>) {
    this.store.set(locality, readings);
  }
}

/** Return a Date that is `hoursAgo` hours before now. */
function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function makeReading(overrides: Partial<ParsedReading> & { sensorId: number; timestamp: Date }): ParsedReading {
  return {
    sensorType: "SDS011",
    lat: 42.69,
    lng: 23.32,
    p1: 25,
    p2: 12,
    ...overrides,
  };
}

describe("ReadingsStore", () => {
  let backend: MemoryBackend;
  let store: ReadingsStore;

  beforeEach(() => {
    backend = new MemoryBackend();
    store = new ReadingsStore(backend);
  });

  describe("appendAndPrune", () => {
    it("stores new readings into an empty store", async () => {
      const readings = [
        makeReading({ sensorId: 1, timestamp: hoursAgo(1) }),
        makeReading({ sensorId: 2, timestamp: hoursAgo(1) }),
      ];

      const result = await store.appendAndPrune("bg.sofia", readings);

      expect(result.stored).toBe(2);
      expect(result.cleaned).toBe(0);

      const stored = backend.store.get("bg.sofia");
      expect(stored).toHaveLength(2);
    });

    it("deduplicates readings by sensorId + timestamp", async () => {
      const ts = hoursAgo(1);
      const readings = [
        makeReading({ sensorId: 1, timestamp: ts }),
      ];

      await store.appendAndPrune("bg.sofia", readings);
      const result = await store.appendAndPrune("bg.sofia", readings);

      expect(result.stored).toBe(0);
      expect(backend.store.get("bg.sofia")).toHaveLength(1);
    });

    it("prunes readings older than retention window", async () => {
      // DATA_RETENTION_HOURS is 24, so anything > 24h ago should be pruned
      const oldTimestamp = hoursAgo(25);
      const newTimestamp = hoursAgo(1);

      // Pre-seed the backend with an old reading (simulates a previous fetch)
      backend.store.set("bg.sofia", [{
        sensorId: 1,
        sensorType: "SDS011",
        timestamp: oldTimestamp.toISOString(),
        lat: 42.69,
        lng: 23.32,
        p1: 25,
        p2: 12,
      }]);

      // Append a new reading — old one should be pruned
      const result = await store.appendAndPrune("bg.sofia", [
        makeReading({ sensorId: 2, timestamp: newTimestamp }),
      ]);

      expect(result.stored).toBe(1);
      expect(result.cleaned).toBe(1);
      expect(backend.store.get("bg.sofia")).toHaveLength(1);
      expect(backend.store.get("bg.sofia")![0].sensorId).toBe(2);
    });

    it("handles empty input gracefully", async () => {
      const result = await store.appendAndPrune("bg.sofia", []);

      expect(result.stored).toBe(0);
      expect(result.cleaned).toBe(0);
    });

    it("preserves all reading fields through round-trip", async () => {
      const ts = hoursAgo(1);
      const reading = makeReading({
        sensorId: 42,
        sensorType: "BME280",
        timestamp: ts,
        lat: 42.123,
        lng: 23.456,
        p1: 50.0,
        p2: 25.5,
      });

      await store.appendAndPrune("bg.sofia", [reading]);

      const stored = backend.store.get("bg.sofia")!;
      expect(stored[0]).toEqual({
        sensorId: 42,
        sensorType: "BME280",
        timestamp: ts.toISOString(),
        lat: 42.123,
        lng: 23.456,
        p1: 50.0,
        p2: 25.5,
      });
    });
  });

  describe("getReadingsInRange", () => {
    it("returns empty array when no data exists", async () => {
      const result = await store.getReadingsInRange(
        "bg.sofia",
        hoursAgo(3),
        new Date(),
      );

      expect(result).toEqual([]);
    });

    it("filters readings to the requested time range", async () => {
      const readings = [
        makeReading({ sensorId: 1, timestamp: hoursAgo(3) }),
        makeReading({ sensorId: 2, timestamp: hoursAgo(2) }),
        makeReading({ sensorId: 3, timestamp: hoursAgo(1) }),
      ];

      await store.appendAndPrune("bg.sofia", readings);

      const result = await store.getReadingsInRange(
        "bg.sofia",
        hoursAgo(2.5),
        hoursAgo(1.5),
      );

      expect(result).toHaveLength(1);
      expect(result[0].sensorId).toBe(2);
    });

    it("includes boundary timestamps (inclusive range)", async () => {
      const ts = hoursAgo(1);

      await store.appendAndPrune("bg.sofia", [
        makeReading({ sensorId: 1, timestamp: ts }),
      ]);

      const result = await store.getReadingsInRange("bg.sofia", ts, ts);

      expect(result).toHaveLength(1);
    });

    it("reconstitutes Date objects on returned readings", async () => {
      const ts = hoursAgo(1);

      await store.appendAndPrune("bg.sofia", [
        makeReading({ sensorId: 1, timestamp: ts }),
      ]);

      const result = await store.getReadingsInRange(
        "bg.sofia",
        hoursAgo(2),
        new Date(),
      );

      expect(result[0].timestamp).toBeInstanceOf(Date);
      expect(result[0].timestamp.toISOString()).toBe(ts.toISOString());
    });

    it("isolates localities from each other", async () => {
      await store.appendAndPrune("bg.sofia", [
        makeReading({ sensorId: 1, timestamp: hoursAgo(1) }),
      ]);

      await store.appendAndPrune("bg.plovdiv", [
        makeReading({ sensorId: 2, timestamp: hoursAgo(1) }),
      ]);

      const sofia = await store.getReadingsInRange(
        "bg.sofia",
        hoursAgo(2),
        new Date(),
      );

      expect(sofia).toHaveLength(1);
      expect(sofia[0].sensorId).toBe(1);
    });
  });
});
