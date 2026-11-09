import { describe, expect, it } from "vitest";
import {
  getSofiaDateKey,
  getSofiaDayRange,
  shiftCalendarDate,
  validateCalendarDate,
} from "./sofia-calendar";

describe("Sofia calendar", () => {
  it("uses the Sofia date on either side of UTC midnight", () => {
    expect(getSofiaDateKey(new Date("2026-11-08T22:10:00Z"))).toBe("2026-11-09");
  });

  it.each([
    ["2026-03-29", "2026-03-28T22:00:00.000Z", "2026-03-29T21:00:00.000Z"],
    ["2026-10-25", "2026-10-24T21:00:00.000Z", "2026-10-25T22:00:00.000Z"],
    ["2026-11-09", "2026-11-08T22:00:00.000Z", "2026-11-09T22:00:00.000Z"],
  ])("finds daylight-saving-aware bounds for %s", (date, start, end) => {
    expect(getSofiaDayRange(date)).toEqual({ start, end });
  });

  it("shifts calendar dates across month and year boundaries", () => {
    expect(shiftCalendarDate("2026-01-01", -1)).toBe("2025-12-31");
  });

  it.each(["2026-02-30", "2026-13-01", "2026-1-1", "no-date"])(
    "rejects %s",
    (date) => {
      expect(() => validateCalendarDate(date)).toThrow();
    },
  );
});
