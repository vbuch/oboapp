import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DbClient } from "../types";
import { EventsRepository, EVENTS_COLLECTION } from "./events";

function createMockClient(): DbClient {
  return {
    findOne: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    insertOne: vi.fn().mockResolvedValue("auto-id"),
    createOne: vi.fn().mockResolvedValue("created-id"),
    updateOne: vi.fn().mockResolvedValue(undefined),
    deleteOne: vi.fn().mockResolvedValue(undefined),
    deleteMany: vi.fn().mockResolvedValue(0),
    batchWrite: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(0),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

describe("EventsRepository", () => {
  let db: DbClient;
  let repo: EventsRepository;

  beforeEach(() => {
    db = createMockClient();
    repo = new EventsRepository(db);
  });

  it("findById delegates to findOne", async () => {
    await repo.findById("evt-1");
    expect(db.findOne).toHaveBeenCalledWith(EVENTS_COLLECTION, "evt-1");
  });

  it("findMany delegates with correct collection", async () => {
    const opts = {
      where: [{ field: "locality", op: "==" as const, value: "bg.sofia" }],
      limit: 10,
    };
    await repo.findMany(opts);
    expect(db.findMany).toHaveBeenCalledWith(EVENTS_COLLECTION, opts);
  });

  it("insertOne without id", async () => {
    const data = { plainText: "test" };
    const id = await repo.insertOne(data);
    expect(db.insertOne).toHaveBeenCalledWith(EVENTS_COLLECTION, data, undefined);
    expect(id).toBe("auto-id");
  });

  it("insertOne with explicit id", async () => {
    const data = { plainText: "test" };
    await repo.insertOne(data, "custom-id");
    expect(db.insertOne).toHaveBeenCalledWith(EVENTS_COLLECTION, data, "custom-id");
  });

  it("updateOne delegates correctly", async () => {
    await repo.updateOne("evt-1", { messageCount: 2 });
    expect(db.updateOne).toHaveBeenCalledWith(EVENTS_COLLECTION, "evt-1", {
      messageCount: 2,
    });
  });

  it("deleteOne delegates correctly", async () => {
    await repo.deleteOne("evt-1");
    expect(db.deleteOne).toHaveBeenCalledWith(EVENTS_COLLECTION, "evt-1");
  });

  it("count delegates correctly", async () => {
    const where = [{ field: "locality", op: "==" as const, value: "bg.sofia" }];
    await repo.count(where);
    expect(db.count).toHaveBeenCalledWith(EVENTS_COLLECTION, where);
  });

  describe("findCandidates", () => {
    it("queries by locality and time window, filters timespanStart in memory", async () => {
      const start = new Date("2025-03-01T00:00:00Z");
      const end = new Date("2025-03-05T00:00:00Z");

      // Mock returns events — one within range, one outside
      vi.mocked(db.findMany).mockResolvedValueOnce([
        { _id: "e1", timespanStart: "2025-03-02T00:00:00Z", timespanEnd: "2025-03-04T00:00:00Z" },
        { _id: "e2", timespanStart: "2025-03-10T00:00:00Z", timespanEnd: "2025-03-12T00:00:00Z" },
      ]);

      const results = await repo.findCandidates("bg.sofia", start, end);

      // Query uses only timespanEnd range (Firestore-compatible)
      expect(db.findMany).toHaveBeenCalledWith(EVENTS_COLLECTION, {
        where: [
          { field: "locality", op: "==", value: "bg.sofia" },
          { field: "timespanEnd", op: ">=", value: start.toISOString() },
        ],
      });

      // timespanStart > windowEnd filtered out in memory
      expect(results).toHaveLength(1);
      expect(results[0]._id).toBe("e1");
    });

    it("includes events with no timespanStart", async () => {
      const start = new Date("2025-03-01T00:00:00Z");
      const end = new Date("2025-03-05T00:00:00Z");

      vi.mocked(db.findMany).mockResolvedValueOnce([
        { _id: "e1", timespanStart: null, timespanEnd: "2025-03-04T00:00:00Z" },
      ]);

      const results = await repo.findCandidates("bg.sofia", start, end);
      expect(results).toHaveLength(1);
    });

    it("adds cityWide filter when requested", async () => {
      const start = new Date("2025-03-01T00:00:00Z");
      const end = new Date("2025-03-05T00:00:00Z");

      vi.mocked(db.findMany).mockResolvedValueOnce([]);

      await repo.findCandidates("bg.sofia", start, end, {
        cityWideOnly: true,
      });

      expect(db.findMany).toHaveBeenCalledWith(EVENTS_COLLECTION, {
        where: [
          { field: "locality", op: "==", value: "bg.sofia" },
          { field: "timespanEnd", op: ">=", value: start.toISOString() },
          { field: "cityWide", op: "==", value: true },
        ],
      });
    });

    it("omits cityWide filter when not requested", async () => {
      const start = new Date("2025-03-01T00:00:00Z");
      const end = new Date("2025-03-05T00:00:00Z");

      vi.mocked(db.findMany).mockResolvedValueOnce([]);

      await repo.findCandidates("bg.sofia", start, end, {
        cityWideOnly: false,
      });

      const call = vi.mocked(db.findMany).mock.calls[0];
      const where = (call[1] as { where: unknown[] }).where;
      expect(where).toHaveLength(2); // locality + timespanEnd only
    });
  });
});
