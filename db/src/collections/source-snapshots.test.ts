import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceSnapshot } from "@oboapp/shared";
import type { BatchOperation, DbClient } from "../types";
import {
  SOURCE_SNAPSHOTS_COLLECTION,
  SourceSnapshotsRepository,
} from "./source-snapshots";

const snapshot: SourceSnapshot = {
  sourceType: "toplo-bg",
  locality: "bg.sofia",
  count: 99,
  observedAt: "2026-11-09T19:30:00.000Z",
};

function createMockClient(): DbClient {
  return {
    findPage: vi.fn().mockResolvedValue({ documents: [], nextCursor: null }),
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

describe("SourceSnapshotsRepository", () => {
  let db: DbClient;
  let repository: SourceSnapshotsRepository;

  beforeEach(() => {
    db = createMockClient();
    repository = new SourceSnapshotsRepository(db);
  });

  it("retains a separate history record for each observation", async () => {
    const records = new Map<string, BatchOperation>();
    vi.mocked(db.batchWrite).mockImplementation(async (operations) => {
      for (const operation of operations) {
        records.set(operation.id, operation);
      }
    });

    await repository.save(snapshot);
    await repository.save({
      ...snapshot,
      count: 94,
      observedAt: "2026-11-09T20:00:00.000Z",
    });
    await repository.save({
      ...snapshot,
      count: 104,
      observedAt: "2026-11-09T19:00:00.000Z",
    });

    expect(records.size).toBe(3);
    expect(Array.from(records.values(), (record) => record.data)).toEqual([
      snapshot,
      { ...snapshot, count: 94, observedAt: "2026-11-09T20:00:00.000Z" },
      { ...snapshot, count: 104, observedAt: "2026-11-09T19:00:00.000Z" },
    ]);
  });

  it("normalizes timestamps and reuses the same record for an observation retry", async () => {
    await repository.save({ ...snapshot, observedAt: "2026-11-09T19:30:00Z" });
    await repository.save(snapshot);

    const [first, second] = vi.mocked(db.batchWrite).mock.calls;
    expect(first[0]).toEqual(second[0]);
    expect(first[0][0]).toEqual({
      type: "set",
      collection: SOURCE_SNAPSHOTS_COLLECTION,
      id: expect.any(String),
      data: snapshot,
    });
  });

  it("keeps source and locality identities separate", async () => {
    await repository.save(snapshot);
    await repository.save({ ...snapshot, sourceType: "other-source" });
    await repository.save({ ...snapshot, locality: "bg.plovdiv" });

    const ids = vi.mocked(db.batchWrite).mock.calls.map(([operations]) => {
      return operations[0].id;
    });

    expect(new Set(ids).size).toBe(3);
  });

  it("rejects invalid observations before writing", async () => {
    await expect(repository.save({ ...snapshot, count: -1 })).rejects.toThrow();
    expect(db.batchWrite).not.toHaveBeenCalled();
  });

  it("retains incident fields and rejects incomplete incident snapshots", async () => {
    const incident = {
      id: "one",
      accidentId: "accident-one",
      name: "Яворов",
      addresses: "Цар Иван Асен II 42",
      type: "accident" as const,
      status: 1,
      reportedStart: "2025-11-04T15:00:00Z",
      estimatedEnd: "2026-11-15T20:00:00Z",
      createdAt: null,
    };
    const complete = { ...snapshot, count: 1, incidents: [incident] };

    await repository.save(complete);
    expect(db.batchWrite).toHaveBeenCalledWith([
      expect.objectContaining({ data: complete }),
    ]);
    await expect(repository.save({ ...complete, count: 2 })).rejects.toThrow();
    await expect(repository.save({ ...complete, count: 2, incidents: [incident, incident] })).rejects.toThrow();
    vi.mocked(db.findMany).mockResolvedValue([complete]);
    expect(await repository.findLatest("toplo-bg", "bg.sofia")).toEqual(complete);
  });

  it("finds the newest observation for the requested source and locality", async () => {
    vi.mocked(db.findMany).mockResolvedValue([{ ...snapshot, _id: "snapshot-id" }]);

    await expect(repository.findLatest("toplo-bg", "bg.sofia")).resolves.toEqual(
      snapshot,
    );
    expect(db.findMany).toHaveBeenCalledWith(SOURCE_SNAPSHOTS_COLLECTION, {
      where: [
        { field: "locality", op: "==", value: "bg.sofia" },
        { field: "sourceType", op: "==", value: "toplo-bg" },
      ],
      orderBy: [{ field: "observedAt", direction: "desc" }],
      limit: 1,
    });
  });

  it("returns null when no observation has been saved", async () => {
    await expect(repository.findLatest("toplo-bg", "bg.sofia")).resolves.toBeNull();
  });

  it("returns a successful zero count", async () => {
    vi.mocked(db.findMany).mockResolvedValue([{ ...snapshot, count: 0 }]);

    await expect(repository.findLatest("toplo-bg", "bg.sofia")).resolves.toEqual({
      ...snapshot,
      count: 0,
    });
  });

  it("rejects a corrupt stored observation", async () => {
    vi.mocked(db.findMany).mockResolvedValue([{ ...snapshot, count: -1 }]);

    await expect(repository.findLatest("toplo-bg", "bg.sofia")).rejects.toThrow();
  });
});
