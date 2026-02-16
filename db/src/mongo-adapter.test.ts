import { describe, it, expect, vi, beforeEach } from "vitest";
import { MongoAdapter } from "./mongo-adapter";

type CursorMock = {
  sort: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  project: ReturnType<typeof vi.fn>;
  toArray: ReturnType<typeof vi.fn>;
};

function createCursorMock(docs: Record<string, unknown>[] = []): CursorMock {
  const cursor = {
    sort: vi.fn(),
    limit: vi.fn(),
    project: vi.fn(),
    toArray: vi.fn().mockResolvedValue(docs),
  };

  cursor.sort.mockReturnValue(cursor);
  cursor.limit.mockReturnValue(cursor);
  cursor.project.mockReturnValue(cursor);

  return cursor;
}

describe("MongoAdapter", () => {
  const findMock = vi.fn();
  const bulkWriteMock = vi.fn().mockResolvedValue(undefined);
  const countDocumentsMock = vi.fn();
  const updateOneMock = vi.fn();
  const deleteManyMock = vi.fn();
  const collectionMock = {
    find: findMock,
    bulkWrite: bulkWriteMock,
    countDocuments: countDocumentsMock,
    updateOne: updateOneMock,
    deleteMany: deleteManyMock,
  };

  const dbMock = {
    collection: vi.fn().mockReturnValue(collectionMock),
  };

  const clientMock = {
    db: vi.fn().mockReturnValue(dbMock),
    close: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.collection.mockReturnValue(collectionMock);
  });

  it("builds an $and filter when multiple where clauses target the same field", async () => {
    const cursor = createCursorMock([]);
    findMock.mockReturnValue(cursor);

    const adapter = new MongoAdapter(clientMock as any, "oboapp");
    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = new Date("2026-01-31T23:59:59.999Z");

    await adapter.findMany("messages", {
      where: [
        { field: "finalizedAt", op: ">", value: start },
        { field: "finalizedAt", op: "<=", value: end },
      ],
    });

    expect(findMock).toHaveBeenCalledWith({
      $and: [{ finalizedAt: { $gt: start } }, { finalizedAt: { $lte: end } }],
    });
  });

  it("uses replaceOne for set operations without merge", async () => {
    const adapter = new MongoAdapter(clientMock as any, "oboapp");

    await adapter.batchWrite([
      {
        type: "set",
        collection: "messages",
        id: "msg-1",
        data: { text: "hello" },
      },
    ]);

    expect(bulkWriteMock).toHaveBeenCalledWith([
      {
        replaceOne: {
          filter: { _id: "msg-1" },
          replacement: { _id: "msg-1", text: "hello" },
          upsert: true,
        },
      },
    ]);
  });

  it("uses updateOne with $set for set operations with merge=true", async () => {
    const adapter = new MongoAdapter(clientMock as any, "oboapp");

    await adapter.batchWrite([
      {
        type: "set",
        collection: "messages",
        id: "msg-1",
        data: { text: "hello" },
        merge: true,
      },
    ]);

    expect(bulkWriteMock).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: "msg-1" },
          update: { $set: { _id: "msg-1", text: "hello" } },
          upsert: true,
        },
      },
    ]);
  });
});
