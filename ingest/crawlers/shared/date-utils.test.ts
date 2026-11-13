import { describe, expect, it } from "vitest";
import {
  formatBulgarianDateTime,
  parseBulgarianDate,
  parseBulgarianDateTime,
  parseBulgarianMonthDate,
  parseShortBulgarianDateTime,
} from "./date-utils";

describe("parseBulgarianDate", () => {
  it("should parse date with dot separator (DD.MM.YYYY)", () => {
    const isoDate = parseBulgarianDate("29.12.2025");

    const date = new Date(isoDate);
    expect(date.getDate()).toBe(29);
    expect(date.getMonth()).toBe(11); // December (0-indexed)
    expect(date.getFullYear()).toBe(2025);
  });

  it("should parse date with slash separator (DD/MM/YYYY)", () => {
    const isoDate = parseBulgarianDate("29/12/2025");

    const date = new Date(isoDate);
    expect(date.getDate()).toBe(29);
    expect(date.getMonth()).toBe(11); // December
    expect(date.getFullYear()).toBe(2025);
  });

  it("should parse date with leading zeros", () => {
    const isoDate = parseBulgarianDate("01.01.2025");

    const date = new Date(isoDate);
    expect(date.getDate()).toBe(1);
    expect(date.getMonth()).toBe(0); // January
    expect(date.getFullYear()).toBe(2025);
  });

  it("should parse date with slash and leading zeros", () => {
    const isoDate = parseBulgarianDate("05/03/2025");

    const date = new Date(isoDate);
    expect(date.getDate()).toBe(5);
    expect(date.getMonth()).toBe(2); // March
    expect(date.getFullYear()).toBe(2025);
  });

  it("should return current date ISO string for invalid format", () => {
    const before = new Date();
    const isoDate = parseBulgarianDate("invalid-date");
    const after = new Date();

    const parsed = new Date(isoDate);
    expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(parsed.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("should return current date ISO string for empty string", () => {
    const before = new Date();
    const isoDate = parseBulgarianDate("");
    const after = new Date();

    const parsed = new Date(isoDate);
    expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(parsed.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("should handle mixed separators by normalizing to dots", () => {
    const isoDate = parseBulgarianDate("15/06/2025");

    const date = new Date(isoDate);
    expect(date.getDate()).toBe(15);
    expect(date.getMonth()).toBe(5); // June
    expect(date.getFullYear()).toBe(2025);
  });

  it("should return ISO string format", () => {
    const isoDate = parseBulgarianDate("29.12.2025");

    // ISO string should match YYYY-MM-DDTHH:mm:ss.sssZ format
    expect(isoDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("should parse date with 2-digit year (DD.MM.YY)", () => {
    const isoDate = parseBulgarianDate("17.07.25");

    const date = new Date(isoDate);
    expect(date.getDate()).toBe(17);
    expect(date.getMonth()).toBe(6); // July (0-indexed)
    expect(date.getFullYear()).toBe(2025);
  });

  it("should parse date with 2-digit year and slash separator (DD/MM/YY)", () => {
    const isoDate = parseBulgarianDate("15/03/24");

    const date = new Date(isoDate);
    expect(date.getDate()).toBe(15);
    expect(date.getMonth()).toBe(2); // March
    expect(date.getFullYear()).toBe(2024);
  });

  it("should parse date with 2-digit year and leading zeros (DD.MM.YY)", () => {
    const isoDate = parseBulgarianDate("01.01.26");

    const date = new Date(isoDate);
    expect(date.getDate()).toBe(1);
    expect(date.getMonth()).toBe(0); // January
    expect(date.getFullYear()).toBe(2026);
  });

  it("should handle 2-digit year assuming 20XX century", () => {
    const isoDate = parseBulgarianDate("31.12.99");

    const date = new Date(isoDate);
    expect(date.getDate()).toBe(31);
    expect(date.getMonth()).toBe(11); // December
    expect(date.getFullYear()).toBe(2099);
  });
});

describe("parseBulgarianDateTime", () => {
  it("should parse valid Bulgarian date format", () => {
    const date = parseBulgarianDateTime("29.12.2025 10:51");

    expect(date.getDate()).toBe(29);
    expect(date.getMonth()).toBe(11); // December (0-indexed)
    expect(date.getFullYear()).toBe(2025);
    expect(date.getHours()).toBe(10);
    expect(date.getMinutes()).toBe(51);
  });

  it("should parse date with leading zeros", () => {
    const date = parseBulgarianDateTime("01.01.2025 09:05");

    expect(date.getDate()).toBe(1);
    expect(date.getMonth()).toBe(0); // January
    expect(date.getFullYear()).toBe(2025);
    expect(date.getHours()).toBe(9);
    expect(date.getMinutes()).toBe(5);
  });

  it("should parse midnight correctly", () => {
    const date = parseBulgarianDateTime("15.06.2025 00:00");

    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });

  it("should parse end of day correctly", () => {
    const date = parseBulgarianDateTime("15.06.2025 23:59");

    expect(date.getHours()).toBe(23);
    expect(date.getMinutes()).toBe(59);
  });

  it("should throw error for invalid format - missing time", () => {
    expect(() => parseBulgarianDateTime("29.12.2025")).toThrow(
      'Date string does not match Bulgarian format "DD.MM.YYYY HH:MM"',
    );
  });

  it("should throw error for invalid format - wrong separator", () => {
    expect(() => parseBulgarianDateTime("29-12-2025 10:51")).toThrow(
      'Date string does not match Bulgarian format "DD.MM.YYYY HH:MM"',
    );
  });

  it("should throw error for invalid month", () => {
    expect(() => parseBulgarianDateTime("29.13.2025 10:51")).toThrow(
      "Invalid month: 13",
    );
  });

  it("should throw error for invalid day", () => {
    expect(() => parseBulgarianDateTime("32.12.2025 10:51")).toThrow(
      "Invalid day: 32",
    );
  });

  it("should throw error for invalid hour", () => {
    expect(() => parseBulgarianDateTime("29.12.2025 24:00")).toThrow(
      "Invalid hour: 24",
    );
  });

  it("should throw error for invalid minute", () => {
    expect(() => parseBulgarianDateTime("29.12.2025 10:60")).toThrow(
      "Invalid minute: 60",
    );
  });

  it("should throw error for non-existent date (Feb 31)", () => {
    expect(() => parseBulgarianDateTime("31.02.2025 10:51")).toThrow(
      "Invalid date (out of range)",
    );
  });

  it("should throw error for empty string", () => {
    expect(() => parseBulgarianDateTime("")).toThrow("Invalid date string");
  });

  it("should throw error for null/undefined", () => {
    expect(() => parseBulgarianDateTime(null as any)).toThrow(
      "Invalid date string",
    );
  });

  it("should handle leap year February 29", () => {
    const date = parseBulgarianDateTime("29.02.2024 12:00"); // 2024 is a leap year

    expect(date.getDate()).toBe(29);
    expect(date.getMonth()).toBe(1); // February
    expect(date.getFullYear()).toBe(2024);
  });

  it("should reject February 29 in non-leap year", () => {
    expect(() => parseBulgarianDateTime("29.02.2025 12:00")).toThrow(
      "Invalid date (out of range)",
    );
  });
});

describe("formatBulgarianDateTime", () => {
  it("should format date to Bulgarian format", () => {
    const date = new Date(2025, 11, 29, 10, 51); // December 29, 2025, 10:51
    const formatted = formatBulgarianDateTime(date);

    expect(formatted).toBe("29.12.2025 10:51");
  });

  it("should add leading zeros for single-digit values", () => {
    const date = new Date(2025, 0, 1, 9, 5); // January 1, 2025, 09:05
    const formatted = formatBulgarianDateTime(date);

    expect(formatted).toBe("01.01.2025 09:05");
  });

  it("should format midnight correctly", () => {
    const date = new Date(2025, 5, 15, 0, 0); // June 15, 2025, 00:00
    const formatted = formatBulgarianDateTime(date);

    expect(formatted).toBe("15.06.2025 00:00");
  });

  it("should round-trip correctly", () => {
    const original = "29.12.2025 10:51";
    const parsed = parseBulgarianDateTime(original);
    const formatted = formatBulgarianDateTime(parsed);

    expect(formatted).toBe(original);
  });
});

describe("parseShortBulgarianDateTime", () => {
  it("should parse date with 2-digit year and time", () => {
    const isoDate = parseShortBulgarianDateTime("17.07.25", "18:48");

    const date = new Date(isoDate);
    expect(date.getDate()).toBe(17);
    expect(date.getMonth()).toBe(6); // July (0-indexed)
    expect(date.getFullYear()).toBe(2025);
    expect(date.getHours()).toBe(18);
    expect(date.getMinutes()).toBe(48);
  });

  it("should parse date with 2-digit year without time", () => {
    const isoDate = parseShortBulgarianDateTime("17.07.25");

    const date = new Date(isoDate);
    expect(date.getDate()).toBe(17);
    expect(date.getMonth()).toBe(6); // July
    expect(date.getFullYear()).toBe(2025);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });

  it("should parse date with leading zeros", () => {
    const isoDate = parseShortBulgarianDateTime("01.01.26", "09:05");

    const date = new Date(isoDate);
    expect(date.getDate()).toBe(1);
    expect(date.getMonth()).toBe(0); // January
    expect(date.getFullYear()).toBe(2026);
    expect(date.getHours()).toBe(9);
    expect(date.getMinutes()).toBe(5);
  });

  it("should always assume 20XX for 2-digit year", () => {
    // Test with year 99 (should be 2099, not 1999)
    const isoDate = parseShortBulgarianDateTime("31.12.99", "23:59");

    const date = new Date(isoDate);
    expect(date.getFullYear()).toBe(2099);
  });

  it("should handle slash separators", () => {
    const isoDate = parseShortBulgarianDateTime("15/06/25", "14:30");

    const date = new Date(isoDate);
    expect(date.getDate()).toBe(15);
    expect(date.getMonth()).toBe(5); // June
    expect(date.getFullYear()).toBe(2025);
  });

  it("should return current date ISO string for invalid format", () => {
    const before = new Date();
    const isoDate = parseShortBulgarianDateTime("invalid-date");
    const after = new Date();

    const parsed = new Date(isoDate);
    expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(parsed.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("should return current date ISO string for empty string", () => {
    const before = new Date();
    const isoDate = parseShortBulgarianDateTime("");
    const after = new Date();

    const parsed = new Date(isoDate);
    expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(parsed.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("should handle time without leading zeros", () => {
    const isoDate = parseShortBulgarianDateTime("17.07.25", "9:5");

    const date = new Date(isoDate);
    expect(date.getHours()).toBe(9);
    expect(date.getMinutes()).toBe(5);
  });

  it("should return ISO string format", () => {
    const isoDate = parseShortBulgarianDateTime("17.07.25", "18:48");

    // ISO string should match YYYY-MM-DDTHH:mm:ss.sssZ format
    expect(isoDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

describe("parseBulgarianMonthDate", () => {
  it("should parse date with Bulgarian month name (DD Month YYYY)", () => {
    const isoDate = parseBulgarianMonthDate("20 октомври 2025");

    const date = new Date(isoDate);
    expect(date.getDate()).toBe(20);
    expect(date.getMonth()).toBe(9); // October (0-indexed)
    expect(date.getFullYear()).toBe(2025);
  });

  it("should handle capitalized month names", () => {
    const isoDate = parseBulgarianMonthDate("20 Октомври 2025");

    const date = new Date(isoDate);
    expect(date.getDate()).toBe(20);
    expect(date.getMonth()).toBe(9); // October
    expect(date.getFullYear()).toBe(2025);
  });

  it("should parse all Bulgarian months correctly", () => {
    const testCases = [
      { input: "15 януари 2025", month: 0 },
      { input: "15 февруари 2025", month: 1 },
      { input: "15 март 2025", month: 2 },
      { input: "15 април 2025", month: 3 },
      { input: "15 май 2025", month: 4 },
      { input: "15 юни 2025", month: 5 },
      { input: "15 юли 2025", month: 6 },
      { input: "27 август 2025", month: 7 },
      { input: "19 септември 2025", month: 8 },
      { input: "14 октомври 2025", month: 9 },
      { input: "15 ноември 2025", month: 10 },
      { input: "15 декември 2025", month: 11 },
    ];

    for (const { input, month } of testCases) {
      const isoDate = parseBulgarianMonthDate(input);
      const date = new Date(isoDate);
      expect(date.getMonth()).toBe(month);
      expect(date.getFullYear()).toBe(2025);
    }
  });

  it("should handle single-digit days", () => {
    const isoDate = parseBulgarianMonthDate("3 февруари 2026");

    const date = new Date(isoDate);
    expect(date.getDate()).toBe(3);
    expect(date.getMonth()).toBe(1); // February
    expect(date.getFullYear()).toBe(2026);
  });

  it("should handle different years", () => {
    const isoDate = parseBulgarianMonthDate("25 декември 2024");

    const date = new Date(isoDate);
    expect(date.getDate()).toBe(25);
    expect(date.getMonth()).toBe(11); // December
    expect(date.getFullYear()).toBe(2024);
  });

  it("should handle uppercase month names", () => {
    const isoDate = parseBulgarianMonthDate("1 ЯНУАРИ 2025");

    const date = new Date(isoDate);
    expect(date.getDate()).toBe(1);
    expect(date.getMonth()).toBe(0); // January
    expect(date.getFullYear()).toBe(2025);
  });

  it("should return current date for invalid format", () => {
    const before = new Date();
    const isoDate = parseBulgarianMonthDate("invalid-date");
    const after = new Date();

    const parsed = new Date(isoDate);
    expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(parsed.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("should return current date for unknown month name", () => {
    const before = new Date();
    const isoDate = parseBulgarianMonthDate("20 foobar 2025");
    const after = new Date();

    const parsed = new Date(isoDate);
    expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(parsed.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("should return current date for empty string", () => {
    const before = new Date();
    const isoDate = parseBulgarianMonthDate("");
    const after = new Date();

    const parsed = new Date(isoDate);
    expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(parsed.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("should return ISO string format", () => {
    const isoDate = parseBulgarianMonthDate("20 октомври 2025");

    // ISO string should match YYYY-MM-DDTHH:mm:ss.sssZ format
    expect(isoDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("should handle extra whitespace", () => {
    const isoDate = parseBulgarianMonthDate("  20   октомври   2025  ");

    const date = new Date(isoDate);
    expect(date.getDate()).toBe(20);
    expect(date.getMonth()).toBe(9); // October
    expect(date.getFullYear()).toBe(2025);
  });

  it("should handle February 29 in leap year", () => {
    const isoDate = parseBulgarianMonthDate("29 февруари 2024"); // 2024 is a leap year

    const date = new Date(isoDate);
    expect(date.getDate()).toBe(29);
    expect(date.getMonth()).toBe(1); // February
    expect(date.getFullYear()).toBe(2024);
  });

  it("should return current date for February 29 in non-leap year", () => {
    const before = new Date();
    const isoDate = parseBulgarianMonthDate("29 февруари 2025");
    const after = new Date();

    const parsed = new Date(isoDate);
    expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(parsed.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("should return current date for February 31", () => {
    const before = new Date();
    const isoDate = parseBulgarianMonthDate("31 февруари 2025");
    const after = new Date();

    const parsed = new Date(isoDate);
    expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(parsed.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("should return current date for April 31", () => {
    const before = new Date();
    const isoDate = parseBulgarianMonthDate("31 април 2025");
    const after = new Date();

    const parsed = new Date(isoDate);
    expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(parsed.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("should return current date for June 31", () => {
    const before = new Date();
    const isoDate = parseBulgarianMonthDate("31 юни 2025");
    const after = new Date();

    const parsed = new Date(isoDate);
    expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(parsed.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("should return current date for September 31", () => {
    const before = new Date();
    const isoDate = parseBulgarianMonthDate("31 септември 2025");
    const after = new Date();

    const parsed = new Date(isoDate);
    expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(parsed.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("should return current date for November 31", () => {
    const before = new Date();
    const isoDate = parseBulgarianMonthDate("31 ноември 2025");
    const after = new Date();

    const parsed = new Date(isoDate);
    expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(parsed.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
