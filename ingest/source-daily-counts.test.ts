import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OboDb } from "@oboapp/db";
import {
  importSourceDailyCounts,
  recordSourceDailyCount,
} from "./source-daily-counts";

const snapshot = {
  sourceType: "toplo-bg",
  locality: "bg.sofia",
  count: 99,
  observedAt: "2026-11-09T20:30:00.000Z",
};
let db: OboDb;
const findLatestForDate = vi.fn();
const save = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  findLatestForDate.mockResolvedValue(snapshot);
  save.mockResolvedValue(undefined);
  db = {
    sourceSnapshots: { findLatestForDate },
    sourceDailyCounts: { save },
  } as unknown as OboDb;
});

describe("nightly source counts", () => {
  it("records the last source check with its original time", async () => {
    await expect(
      recordSourceDailyCount(db, {
        sourceType: "toplo-bg",
        locality: "bg.sofia",
        date: "2026-11-09",
      }),
    ).resolves.toEqual({ ...snapshot, date: "2026-11-09" });
    expect(save).toHaveBeenCalledWith({ ...snapshot, date: "2026-11-09" });
  });

  it("does not invent a point when a date has no successful crawl", async () => {
    findLatestForDate.mockResolvedValue(null);
    await expect(
      recordSourceDailyCount(db, {
        sourceType: "toplo-bg",
        locality: "bg.sofia",
        date: "2026-11-09",
      }),
    ).resolves.toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it("records a successful zero", async () => {
    findLatestForDate.mockResolvedValue({ ...snapshot, count: 0 });
    await recordSourceDailyCount(db, {
      sourceType: "toplo-bg",
      locality: "bg.sofia",
      date: "2026-11-09",
    });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ count: 0 }));
  });

  it("validates every import row before writing any of them", async () => {
    await expect(
      importSourceDailyCounts(db, [
        { ...snapshot, date: "2026-11-09" },
        { ...snapshot, date: "2026-11-08" },
      ]),
    ).rejects.toThrow();
    expect(save).not.toHaveBeenCalled();
  });

  it("imports confirmed historical daily counts", async () => {
    const history = [{ ...snapshot, date: "2026-11-09" }];
    await expect(importSourceDailyCounts(db, history)).resolves.toBe(1);
    expect(save).toHaveBeenCalledWith(history[0]);
  });

  it("rejects conflicting duplicate dates before writing", async () => {
    await expect(
      importSourceDailyCounts(db, [
        { ...snapshot, date: "2026-11-09" },
        { ...snapshot, date: "2026-11-09", count: 105 },
      ]),
    ).rejects.toThrow("one point");
    expect(save).not.toHaveBeenCalled();
  });
});
