import { describe, expect, it } from "vitest";
import { SourceSnapshotSchema } from "./source-snapshot.schema";
import { SourceDailyCountSchema } from "./source-daily-count.schema";

describe("source snapshots with optional listing details", () => {
  const count = {
    sourceType: "toplo-bg",
    locality: "bg.sofia",
    count: 0,
    observedAt: "2026-11-11T15:00:00.000Z",
  };

  it("reads legacy observations and distinguishes a complete zero", () => {
    expect(SourceSnapshotSchema.parse(count)).toEqual(count);
    expect(SourceSnapshotSchema.parse({ ...count, incidents: [] })).toEqual({ ...count, incidents: [] });
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid count: %s",
    (invalidCount) => {
      expect(SourceSnapshotSchema.safeParse({ ...count, count: invalidCount }).success).toBe(false);
    },
  );

  it.each([
    { sourceType: "" },
    { locality: "" },
    { observedAt: "2026-11-09" },
    { observedAt: "2026-11-09T19:30:00" },
    { observedAt: "invalid" },
  ])("rejects an incomplete or invalid observation: %j", (fields) => {
    expect(SourceSnapshotSchema.safeParse({ ...count, ...fields }).success).toBe(false);
  });

  it("keeps daily records count-only after detailed captures", () => {
    expect(SourceDailyCountSchema.parse({ ...count, incidents: [], date: "2026-11-11" })).toEqual({
      ...count,
      date: "2026-11-11",
    });
  });
});
