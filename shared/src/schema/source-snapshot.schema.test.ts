import { describe, expect, it } from "vitest";
import { SourceSnapshotSchema } from "./source-snapshot.schema";

const snapshot = {
  sourceType: "toplo-bg",
  locality: "bg.sofia",
  count: 99,
  observedAt: "2026-11-09T19:30:00.000Z",
};

describe("SourceSnapshotSchema", () => {
  it("accepts a verified empty listing", () => {
    expect(SourceSnapshotSchema.parse({ ...snapshot, count: 0 }).count).toBe(0);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid count: %s",
    (count) => {
      expect(SourceSnapshotSchema.safeParse({ ...snapshot, count }).success).toBe(
        false,
      );
    },
  );

  it.each([
    { sourceType: "" },
    { locality: "" },
    { observedAt: "2026-11-09" },
    { observedAt: "2026-11-09T19:30:00" },
    { observedAt: "invalid" },
  ])("rejects an incomplete or invalid observation: %j", (fields) => {
    expect(SourceSnapshotSchema.safeParse({ ...snapshot, ...fields }).success).toBe(
      false,
    );
  });
});
