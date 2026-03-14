import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DbClient } from "../types";
import {
  EventMessagesRepository,
  EVENT_MESSAGES_COLLECTION,
} from "./event-messages";

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

describe("EventMessagesRepository", () => {
  let db: DbClient;
  let repo: EventMessagesRepository;

  beforeEach(() => {
    db = createMockClient();
    repo = new EventMessagesRepository(db);
  });

  it("findById delegates to findOne", async () => {
    await repo.findById("em-1");
    expect(db.findOne).toHaveBeenCalledWith(EVENT_MESSAGES_COLLECTION, "em-1");
  });

  it("findMany delegates with correct collection", async () => {
    const opts = {
      where: [{ field: "eventId", op: "==" as const, value: "evt-1" }],
    };
    await repo.findMany(opts);
    expect(db.findMany).toHaveBeenCalledWith(EVENT_MESSAGES_COLLECTION, opts);
  });

  it("insertOne without id", async () => {
    const data = { eventId: "evt-1", messageId: "msg-1" };
    const id = await repo.insertOne(data);
    expect(db.insertOne).toHaveBeenCalledWith(
      EVENT_MESSAGES_COLLECTION,
      data,
      undefined,
    );
    expect(id).toBe("auto-id");
  });

  it("insertOne with explicit id", async () => {
    const data = { eventId: "evt-1", messageId: "msg-1" };
    await repo.insertOne(data, "custom-id");
    expect(db.insertOne).toHaveBeenCalledWith(
      EVENT_MESSAGES_COLLECTION,
      data,
      "custom-id",
    );
  });

  it("deleteOne delegates correctly", async () => {
    await repo.deleteOne("em-1");
    expect(db.deleteOne).toHaveBeenCalledWith(EVENT_MESSAGES_COLLECTION, "em-1");
  });

  it("updateOne delegates correctly", async () => {
    await repo.updateOne("em-1", { confidence: 0.9 });
    expect(db.updateOne).toHaveBeenCalledWith(
      EVENT_MESSAGES_COLLECTION,
      "em-1",
      { confidence: 0.9 },
    );
  });

  it("count delegates correctly", async () => {
    const where = [{ field: "eventId", op: "==" as const, value: "evt-1" }];
    await repo.count(where);
    expect(db.count).toHaveBeenCalledWith(EVENT_MESSAGES_COLLECTION, where);
  });

  describe("findByEventId", () => {
    it("queries by eventId ordered by createdAt desc", async () => {
      await repo.findByEventId("evt-1");
      expect(db.findMany).toHaveBeenCalledWith(EVENT_MESSAGES_COLLECTION, {
        where: [{ field: "eventId", op: "==", value: "evt-1" }],
        orderBy: [{ field: "createdAt", direction: "desc" }],
      });
    });
  });

  describe("findByMessageId", () => {
    it("queries by messageId", async () => {
      await repo.findByMessageId("msg-1");
      expect(db.findMany).toHaveBeenCalledWith(EVENT_MESSAGES_COLLECTION, {
        where: [{ field: "messageId", op: "==", value: "msg-1" }],
      });
    });
  });
});
