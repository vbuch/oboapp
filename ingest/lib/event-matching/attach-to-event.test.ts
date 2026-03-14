import { describe, it, expect, vi, beforeEach } from "vitest";
import { attachMessageToEvent } from "./attach-to-event";

vi.mock("@/lib/source-trust", () => ({
  getSourceTrust: vi.fn((source: string) => {
    if (source === "toplo-bg") return { trust: 1.0, geometryQuality: 3 };
    if (source === "sofia-bg") return { trust: 0.8, geometryQuality: 2 };
    return { trust: 0.5, geometryQuality: 0 };
  }),
  getGeometryQuality: vi.fn((source: string, hasPrecomputed: boolean) => {
    if (hasPrecomputed) return 3;
    if (source === "toplo-bg") return 3;
    if (source === "sofia-bg") return 2;
    return 0;
  }),
}));

const mockInsertEventMessage = vi.fn().mockResolvedValue("em-new");
const mockUpdateEvent = vi.fn().mockResolvedValue(undefined);
const mockDb = {
  eventMessages: { insertOne: mockInsertEventMessage },
  events: { updateOne: mockUpdateEvent },
} as any;

const baseSignals = { locationSimilarity: 0.9, timeOverlap: 0.8, categoryMatch: 1.0 };

describe("attachMessageToEvent", () => {
  beforeEach(() => {
    mockInsertEventMessage.mockClear();
    mockUpdateEvent.mockClear();
  });

  it("creates EventMessage link with signals", async () => {
    await attachMessageToEvent(
      mockDb,
      { _id: "msg-2", source: "sofia-bg" },
      { _id: "evt-1", geometryQuality: 3, sources: ["toplo-bg"], messageCount: 1 },
      0.85,
      baseSignals,
    );

    const emData = mockInsertEventMessage.mock.calls[0][0];
    expect(emData.eventId).toBe("evt-1");
    expect(emData.messageId).toBe("msg-2");
    expect(emData.confidence).toBe(0.85);
    expect(emData.matchSignals).toEqual(baseSignals);
  });

  it("increments messageCount", async () => {
    await attachMessageToEvent(
      mockDb,
      { _id: "msg-2", source: "sofia-bg" },
      { _id: "evt-1", geometryQuality: 3, sources: ["toplo-bg"], messageCount: 1 },
      0.85,
      baseSignals,
    );

    const update = mockUpdateEvent.mock.calls[0][1];
    expect(update.messageCount).toBe(2);
  });

  it("merges timespans (expands to union)", async () => {
    await attachMessageToEvent(
      mockDb,
      {
        _id: "msg-2",
        source: "sofia-bg",
        timespanStart: "2025-03-01T06:00:00Z", // earlier
        timespanEnd: "2025-03-01T20:00:00Z",   // later
      },
      {
        _id: "evt-1",
        geometryQuality: 2,
        sources: ["toplo-bg"],
        messageCount: 1,
        timespanStart: "2025-03-01T08:00:00Z",
        timespanEnd: "2025-03-01T18:00:00Z",
      },
      0.85,
      baseSignals,
    );

    const update = mockUpdateEvent.mock.calls[0][1];
    expect(update.timespanStart).toBe("2025-03-01T06:00:00Z");
    expect(update.timespanEnd).toBe("2025-03-01T20:00:00Z");
  });

  it("does not shrink timespans when message is narrower", async () => {
    await attachMessageToEvent(
      mockDb,
      {
        _id: "msg-2",
        source: "sofia-bg",
        timespanStart: "2025-03-01T10:00:00Z", // later start
        timespanEnd: "2025-03-01T16:00:00Z",   // earlier end
      },
      {
        _id: "evt-1",
        geometryQuality: 2,
        sources: [],
        messageCount: 1,
        timespanStart: "2025-03-01T08:00:00Z",
        timespanEnd: "2025-03-01T18:00:00Z",
      },
      0.85,
      baseSignals,
    );

    const update = mockUpdateEvent.mock.calls[0][1];
    expect(update.timespanStart).toBeUndefined(); // not updated
    expect(update.timespanEnd).toBeUndefined();   // not updated
  });

  it("upgrades geometry when new quality > existing", async () => {
    const newGeoJson = { type: "FeatureCollection" as const, features: [{ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [23.3, 42.7] as [number, number] }, properties: {} as Record<string, unknown> }] };
    await attachMessageToEvent(
      mockDb,
      { _id: "msg-2", source: "toplo-bg", geoJson: newGeoJson },
      { _id: "evt-1", geometryQuality: 2, sources: ["sofia-bg"], messageCount: 1 },
      0.85,
      baseSignals,
    );

    const update = mockUpdateEvent.mock.calls[0][1];
    expect(update.geometry).toBe(newGeoJson);
    expect(update.geometryQuality).toBe(3);
  });

  it("keeps existing geometry when existing quality >= new", async () => {
    const newGeoJson = { type: "FeatureCollection" as const, features: [] };
    await attachMessageToEvent(
      mockDb,
      { _id: "msg-2", source: "sofia-bg", geoJson: newGeoJson },
      { _id: "evt-1", geometryQuality: 3, sources: ["toplo-bg"], messageCount: 1 },
      0.85,
      baseSignals,
    );

    const update = mockUpdateEvent.mock.calls[0][1];
    expect(update.geometry).toBeUndefined();
    expect(update.geometryQuality).toBeUndefined();
  });

  it("adds source to sources array (deduped)", async () => {
    await attachMessageToEvent(
      mockDb,
      { _id: "msg-2", source: "sofia-bg" },
      { _id: "evt-1", geometryQuality: 3, sources: ["toplo-bg"], messageCount: 1 },
      0.85,
      baseSignals,
    );

    const update = mockUpdateEvent.mock.calls[0][1];
    expect(update.sources).toEqual(["toplo-bg", "sofia-bg"]);
  });

  it("does not duplicate existing source", async () => {
    await attachMessageToEvent(
      mockDb,
      { _id: "msg-2", source: "toplo-bg" },
      { _id: "evt-1", geometryQuality: 3, sources: ["toplo-bg"], messageCount: 1 },
      0.85,
      baseSignals,
    );

    const update = mockUpdateEvent.mock.calls[0][1];
    expect(update.sources).toBeUndefined(); // not updated
  });

  it("merges categories (union)", async () => {
    await attachMessageToEvent(
      mockDb,
      { _id: "msg-2", source: "sofia-bg", categories: ["water", "traffic"] },
      {
        _id: "evt-1",
        geometryQuality: 3,
        sources: [],
        messageCount: 1,
        categories: ["water"],
      },
      0.85,
      baseSignals,
    );

    const update = mockUpdateEvent.mock.calls[0][1];
    expect(update.categories).toEqual(["water", "traffic"]);
  });
});
