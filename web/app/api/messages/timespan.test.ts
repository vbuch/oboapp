import { describe, it, expect } from "vitest";

/**
 * Parse a timespan end date string in format "DD.MM.YYYY HH:MM" to Date object
 */
function parseTimespanDate(dateStr: string): Date | null {
  try {
    // Expected format: "DD.MM.YYYY HH:MM"
    const regex = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/;
    const parts = regex.exec(dateStr);
    if (!parts) return null;

    const [, day, month, year, hours, minutes] = parts;
    return new Date(
      Number.parseInt(year),
      Number.parseInt(month) - 1, // JS months are 0-indexed
      Number.parseInt(day),
      Number.parseInt(hours),
      Number.parseInt(minutes),
    );
  } catch {
    return null;
  }
}

describe("parseTimespanDate", () => {
  it("should parse valid date string correctly", () => {
    const result = parseTimespanDate("15.01.2026 14:30");
    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2026);
    expect(result?.getMonth()).toBe(0); // January is 0
    expect(result?.getDate()).toBe(15);
    expect(result?.getHours()).toBe(14);
    expect(result?.getMinutes()).toBe(30);
  });

  it("should handle single-digit day and month with leading zeros", () => {
    const result = parseTimespanDate("05.03.2026 09:15");
    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2026);
    expect(result?.getMonth()).toBe(2); // March is 2
    expect(result?.getDate()).toBe(5);
    expect(result?.getHours()).toBe(9);
    expect(result?.getMinutes()).toBe(15);
  });

  it("should handle end of year dates", () => {
    const result = parseTimespanDate("31.12.2025 23:59");
    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2025);
    expect(result?.getMonth()).toBe(11); // December is 11
    expect(result?.getDate()).toBe(31);
    expect(result?.getHours()).toBe(23);
    expect(result?.getMinutes()).toBe(59);
  });

  it("should handle start of year dates", () => {
    const result = parseTimespanDate("01.01.2026 00:00");
    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2026);
    expect(result?.getMonth()).toBe(0);
    expect(result?.getDate()).toBe(1);
    expect(result?.getHours()).toBe(0);
    expect(result?.getMinutes()).toBe(0);
  });

  it("should return null for invalid format (missing time)", () => {
    const result = parseTimespanDate("15.01.2026");
    expect(result).toBeNull();
  });

  it("should return null for invalid format (wrong separator)", () => {
    const result = parseTimespanDate("15/01/2026 14:30");
    expect(result).toBeNull();
  });

  it("should return null for invalid format (missing date)", () => {
    const result = parseTimespanDate("14:30");
    expect(result).toBeNull();
  });

  it("should return null for completely invalid string", () => {
    const result = parseTimespanDate("not a date");
    expect(result).toBeNull();
  });

  it("should return null for empty string", () => {
    const result = parseTimespanDate("");
    expect(result).toBeNull();
  });

  it("should return null for date with wrong number of digits", () => {
    const result = parseTimespanDate("5.1.2026 14:30");
    expect(result).toBeNull();
  });

  it("should accept date with multiple spaces between date and time", () => {
    const result = parseTimespanDate("15.01.2026  14:30");
    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2026);
  });

  it("should return null for date with no space before time", () => {
    const result = parseTimespanDate("15.01.202614:30");
    expect(result).toBeNull();
  });
});
