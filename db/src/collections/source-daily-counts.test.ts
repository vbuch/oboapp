import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbClient } from "../types";
import { SourceDailyCountsRepository } from "./source-daily-counts";
import { SourceSnapshotsRepository } from "./source-snapshots";

const observation = {
  sourceType: "toplo-bg",
  locality: "bg.sofia",
  date: "2026-11-08",
  count: 103,
  observedAt: "2026-11-08T19:30:48.965Z",
};
let db: DbClient;
let daily: SourceDailyCountsRepository;

beforeEach(() => {
  db = {
    findOne: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    batchWrite: vi.fn().mockResolvedValue(undefined),
  } as unknown as DbClient;
  daily = new SourceDailyCountsRepository(db);
});

describe("source daily counts", () => {
  it("uses an idempotent per-source, locality and date identity", async () => {
    await daily.save(observation);
    await daily.save({ ...observation, count: 104 });
    const calls = vi.mocked(db.batchWrite).mock.calls;
    expect(calls[0][0][0].id).toBe(calls[1][0][0].id);
    expect(calls[1][0][0].data?.count).toBe(104);
  });

  it("rejects observations assigned to the wrong Sofia day", async () => {
    await expect(
      daily.save({ ...observation, date: "2026-11-09" }),
    ).rejects.toThrow("Sofia date");
    expect(db.batchWrite).not.toHaveBeenCalled();
  });

  it("returns ordered daily records without filling missing days", async () => {
    vi.mocked(db.findMany).mockResolvedValue([observation]);
    await expect(
      daily.findRange("toplo-bg", "bg.sofia", "2026-11-01", "2026-11-09"),
    ).resolves.toEqual([observation]);
    expect(db.findMany).toHaveBeenCalledWith(
      "sourceDailyCounts",
      expect.objectContaining({
        orderBy: [{ field: "date", direction: "asc" }],
        limit: 366,
      }),
    );
  });

  it("rejects inverted and oversized ranges", async () => {
    await expect(
      daily.findRange("toplo-bg", "bg.sofia", "2026-11-09", "2026-11-01"),
    ).rejects.toThrow();
    await expect(
      daily.findRange("toplo-bg", "bg.sofia", "2020-01-01", "2026-11-01"),
    ).rejects.toThrow();
    expect(db.findMany).not.toHaveBeenCalled();
  });

  it("distinguishes zero from a missing date", async () => {
    await expect(
      daily.findByDate("toplo-bg", "bg.sofia", observation.date),
    ).resolves.toBeNull();
    vi.mocked(db.findOne).mockResolvedValue({ ...observation, count: 0 });
    expect(
      (await daily.findByDate("toplo-bg", "bg.sofia", observation.date))?.count,
    ).toBe(0);
  });

  it("only queries source snapshots within the requested Sofia date", async () => {
    const snapshots = new SourceSnapshotsRepository(db);
    await snapshots.findLatestForDate("toplo-bg", "bg.sofia", "2026-10-25");
    expect(db.findMany).toHaveBeenCalledWith("sourceSnapshots", {
      where: [
        { field: "locality", op: "==", value: "bg.sofia" },
        { field: "sourceType", op: "==", value: "toplo-bg" },
        { field: "observedAt", op: ">=", value: "2026-10-24T21:00:00.000Z" },
        { field: "observedAt", op: "<", value: "2026-10-25T22:00:00.000Z" },
      ],
      orderBy: [{ field: "observedAt", direction: "desc" }],
      limit: 1,
    });
  });
});
