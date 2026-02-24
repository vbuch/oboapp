import { logger } from "@/lib/logger";

/**
 * Parse Bulgarian date format (DD.MM.YYYY, DD.MM.YY, or DD/MM/YYYY) to ISO string
 * Supports both 2-digit (YY) and 4-digit (YYYY) years
 */
export function parseBulgarianDate(dateStr: string): string {
  try {
    // Format: "19.12.2025" or "19/12/2025" or "17.07.25"
    // Handle both dot and slash separators
    const normalized = dateStr.trim().replace(/\//g, ".");
    const parts = normalized.split(".");
    if (parts.length === 3) {
      const [day, month, yearPart] = parts;
      let year = yearPart;

      // Convert 2-digit year to 4-digit year (assume 20XX)
      if (year.length === 2) {
        year = `20${year}`;
      }

      const date = new Date(`${year}-${month}-${day}`);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    logger.warn("Unable to parse date, using current date", { dateStr });
    return new Date().toISOString();
  } catch (error) {
    logger.error("Error parsing date", { dateStr, error: error instanceof Error ? error.message : String(error) });
    return new Date().toISOString();
  }
}

/**
 * Parses a Bulgarian date string or date range into UTC-based `Date` objects.
 *
 * Supports:
 * - Single dates with Bulgarian month names: `27 януари 2026` or `27 януари`
 * - Ranges with same month: `15-19.03.2021`
 * - Ranges with different months: `15.02-19.03.2021`
 * - Full dot-form ranges: `15.02.2021-19.03.2021`
 *
 * If the year is omitted for a single date, the current year is assumed.
 * Returns `null` when the input is empty or no known pattern matches.
 *
 * @param dateStr - Input date string to parse.
 * @returns An object with `start` and `end` dates (both in UTC), or `null` if parsing fails.
 */
export function parseBulgarianDateOrRangeLocal(dateStr?: string): { start?: Date; end?: Date } | null {
  if (!dateStr) return null;
  const t = dateStr.trim();
  // Bulgarian month names
  const months: Record<string, number> = {
    януари: 0,
    февруари: 1,
    март: 2,
    април: 3,
    май: 4,
    юни: 5,
    юли: 6,
    август: 7,
    септември: 8,
    октомври: 9,
    ноември: 10,
    декември: 11,
  };

  // Normalize - replace multiple spaces and remove day-of-week in parentheses
  const normalized = t.replace(/\s+/g, " ").replace(/\([^)]*\)/g, "").trim();

  // 1) Pattern: 27 януари 2026 or 27 януари
  const singleMonthRe = /(\d{1,2})\s+([\p{L}]+)\s*(\d{4})?/u;
  const m1 = normalized.match(singleMonthRe);
  if (m1) {
    const [, dayText, monthText, yearText] = m1;
    const day = Number(dayText);
    const monthName = monthText.toLowerCase();
    const year = yearText ? Number(yearText) : new Date().getFullYear();
    const month = months[monthName];
    // Validate month and day
    if (
      month === undefined || day < 1 || day > 31
    ) {
      return null;
    }
    const start = new Date(Date.UTC(year, month, day));
    // Check for invalid date (e.g., 31 Feb)
    if (
      start.getUTCFullYear() !== year || start.getUTCMonth() !== month || start.getUTCDate() !== day
    ) {
      return null;
    }
    return { start, end: start };
  }

  // 2) Range pattern: 15-19.03.2021  -> startDay-endDay.month.year
  const rangeA = normalized.match(/(\d{1,2})-(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (rangeA) {
    const [, startDayText, endDayText, monthText, yearText] = rangeA;
    const year = Number(yearText);
    const month = Number(monthText) - 1;
    const startDay = Number(startDayText);
    const endDay = Number(endDayText);
    // Validate month and days
    if (
      month < 0 || month > 11 ||
      startDay < 1 || startDay > 31 ||
      endDay < 1 || endDay > 31
    ) {
      return null;
    }
    const start = new Date(Date.UTC(year, month, startDay));
    const end = new Date(Date.UTC(year, month, endDay));
    // Check for invalid dates (e.g., 31 Feb)
    if (
      start.getUTCFullYear() !== year || start.getUTCMonth() !== month || start.getUTCDate() !== startDay ||
      end.getUTCFullYear() !== year || end.getUTCMonth() !== month || end.getUTCDate() !== endDay
    ) {
      return null;
    }
    return { start, end };
  }

  // 3) Range pattern: 15.02-19.03.2021 -> startDay.startMonth - endDay.endMonth.year
  const rangeB = normalized.match(/(\d{1,2})\.(\d{1,2})-(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (rangeB) {
    const [, startDayText, startMonthText, endDayText, endMonthText, yearText] = rangeB;
    const year = Number(yearText);
    const startMonth = Number(startMonthText) - 1;
    const endMonth = Number(endMonthText) - 1;
    const startDay = Number(startDayText);
    const endDay = Number(endDayText);
    // Validate months and days
    if (
      startMonth < 0 || startMonth > 11 || endMonth < 0 || endMonth > 11 ||
      startDay < 1 || startDay > 31 || endDay < 1 || endDay > 31
    ) {
      return null;
    }
    const start = new Date(Date.UTC(year, startMonth, startDay));
    const end = new Date(Date.UTC(year, endMonth, endDay));
    // Check for invalid dates (e.g., 31 Feb)
    if (
      start.getUTCFullYear() !== year || start.getUTCMonth() !== startMonth || start.getUTCDate() !== startDay ||
      end.getUTCFullYear() !== year || end.getUTCMonth() !== endMonth || end.getUTCDate() !== endDay
    ) {
      return null;
    }
    return { start, end };
  }

  // 4) Try numeric dates with dots: 15.03.2021 or 15.02.2021-19.03.2021
  const simpleDotRange = normalized.match(/(\d{1,2}\.\d{1,2}\.\d{4})\s*-\s*(\d{1,2}\.\d{1,2}\.\d{4})/);
  if (simpleDotRange) {
    const parseDot = (v: string) => {
      const [d, m, y] = v.split(".").map(Number);
      // Validate month and day
      if (m < 1 || m > 12 || d < 1 || d > 31) {
        return null;
      }
      const date = new Date(Date.UTC(y, m - 1, d));
      // Check for invalid date (e.g., 31 Feb)
      if (
        date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d
      ) {
        return null;
      }
      return date;
    };
    const start = parseDot(simpleDotRange[1]);
    const end = parseDot(simpleDotRange[2]);
    if (!start || !end) {
      return null;
    }
    return { start, end };
  }

  // If nothing matched, return null
  return null;
}

/**
 * Parse Bulgarian date-time format "DD.MM.YYYY HH:MM" to Date object
 *
 * @param dateStr - Date string in Bulgarian format (e.g., "29.12.2025 10:51")
 * @returns Date object in local timezone
 * @throws Error if date string is invalid
 */
export function parseBulgarianDateTime(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== "string") {
    throw new Error(`Invalid date string: ${dateStr}`);
  }

  const trimmed = dateStr.trim();

  // Expected format: "DD.MM.YYYY HH:MM"
  const match = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);

  if (!match) {
    throw new Error(
      `Date string does not match Bulgarian format "DD.MM.YYYY HH:MM": ${dateStr}`,
    );
  }

  const [, day, month, year, hour, minute] = match;

  // Parse components (months are 0-indexed in JavaScript Date)
  const parsedDay = Number.parseInt(day, 10);
  const parsedMonth = Number.parseInt(month, 10) - 1; // 0-indexed
  const parsedYear = Number.parseInt(year, 10);
  const parsedHour = Number.parseInt(hour, 10);
  const parsedMinute = Number.parseInt(minute, 10);

  // Validate ranges
  if (parsedMonth < 0 || parsedMonth > 11) {
    throw new Error(`Invalid month: ${month}`);
  }

  if (parsedDay < 1 || parsedDay > 31) {
    throw new Error(`Invalid day: ${day}`);
  }

  if (parsedHour < 0 || parsedHour > 23) {
    throw new Error(`Invalid hour: ${hour}`);
  }

  if (parsedMinute < 0 || parsedMinute > 59) {
    throw new Error(`Invalid minute: ${minute}`);
  }

  // Create date in local timezone (assumed to be Europe/Sofia)
  const date = new Date(
    parsedYear,
    parsedMonth,
    parsedDay,
    parsedHour,
    parsedMinute,
    0,
    0,
  );

  // Check if date is valid (e.g., not 31st February)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }

  // Verify the parsed date matches input (catches invalid dates like Feb 31)
  if (
    date.getDate() !== parsedDay ||
    date.getMonth() !== parsedMonth ||
    date.getFullYear() !== parsedYear
  ) {
    throw new Error(`Invalid date (out of range): ${dateStr}`);
  }

  return date;
}

/**
 * Parse Bulgarian short date format with 2-digit year (DD.MM.YY) to ISO string
 * Optionally combines with time (HH:MM)
 *
 * @param dateStr - Date string in format "DD.MM.YY" (e.g., "17.07.25")
 * @param timeStr - Optional time string in format "HH:MM" (e.g., "18:48")
 * @returns ISO date string
 *
 * @example
 * parseShortBulgarianDateTime("17.07.25", "18:48") // "2025-07-17T18:48:00.000Z" (in Sofia timezone)
 * parseShortBulgarianDateTime("17.07.25") // "2025-07-17T00:00:00.000Z" (in Sofia timezone)
 */
export function parseShortBulgarianDateTime(
  dateStr: string,
  timeStr?: string,
): string {
  try {
    // Format: "DD.MM.YY" optionally with "HH:MM"
    const normalized = dateStr.trim().replace(/\//g, ".");
    const parts = normalized.split(".");

    if (parts.length === 3) {
      const [day, month, shortYear] = parts;

      // Convert 2-digit year to 4-digit year (always assume 20XX)
      const year = `20${shortYear}`;

      // Parse time if provided
      let hour = "00";
      let minute = "00";
      if (timeStr) {
        const timeParts = timeStr.trim().split(":");
        if (timeParts.length === 2) {
          hour = timeParts[0].padStart(2, "0");
          minute = timeParts[1].padStart(2, "0");
        }
      }

      // Create date in local timezone (assumed to be Europe/Sofia)
      const date = new Date(
        Number.parseInt(year, 10),
        Number.parseInt(month, 10) - 1, // 0-indexed months
        Number.parseInt(day, 10),
        Number.parseInt(hour, 10),
        Number.parseInt(minute, 10),
        0,
        0,
      );

      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    logger.warn("Unable to parse short date, using current date", { dateStr, timeStr: timeStr || "" });
    return new Date().toISOString();
  } catch (error) {
    logger.error("Error parsing short date", { dateStr, timeStr: timeStr || "", error: error instanceof Error ? error.message : String(error) });
    return new Date().toISOString();
  }
}

/**
 * Parse Bulgarian month name date format (DD Month YYYY) to ISO string
 * Example: "20 Октомври 2025" -> ISO date string
 *
 * @param dateStr - Date string in format "DD Month YYYY" (e.g., "20 Октомври 2025")
 * @returns ISO date string
 */
export function parseBulgarianMonthDate(dateStr: string): string {
  try {
    // Month name mapping (case-insensitive)
    const monthMap: Record<string, string> = {
      януари: "01",
      февруари: "02",
      март: "03",
      април: "04",
      май: "05",
      юни: "06",
      юли: "07",
      август: "08",
      септември: "09",
      октомври: "10",
      ноември: "11",
      декември: "12",
    };

    // Clean and normalize the input
    const cleaned = dateStr.trim();

    // Match pattern: "DD Month YYYY" (e.g., "20 Октомври 2025")
    const match = cleaned.match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);

    if (!match) {
      logger.warn("Unable to parse Bulgarian month date, using current date", { dateStr });
      return new Date().toISOString();
    }

    const [, day, monthName, year] = match;
    const monthLower = monthName.toLowerCase();
    const month = monthMap[monthLower];

    if (!month) {
      logger.warn("Unknown Bulgarian month name, using current date", { monthName });
      return new Date().toISOString();
    }

    // Create date in local timezone (assumed to be Europe/Sofia)
    const date = new Date(
      Number.parseInt(year, 10),
      Number.parseInt(month, 10) - 1, // 0-indexed months
      Number.parseInt(day, 10),
      0, // hour
      0, // minute
      0, // second
      0, // millisecond
    );

    if (Number.isNaN(date.getTime())) {
      logger.warn("Invalid date components, using current date", { dateStr });
      return new Date().toISOString();
    }

    // Verify the parsed date matches input (catches invalid dates like Feb 31)
    const parsedDay = Number.parseInt(day, 10);
    const parsedMonth = Number.parseInt(month, 10) - 1; // 0-indexed
    const parsedYear = Number.parseInt(year, 10);

    if (
      date.getDate() !== parsedDay ||
      date.getMonth() !== parsedMonth ||
      date.getFullYear() !== parsedYear
    ) {
      logger.warn("Invalid date (out of range), using current date", { dateStr });
      return new Date().toISOString();
    }

    return date.toISOString();
  } catch (error) {
    logger.error("Error parsing Bulgarian month date", { dateStr, error: error instanceof Error ? error.message : String(error) });
    return new Date().toISOString();
  }
}

/**
 * Format date for display in Bulgarian format
 *
 * @param date - Date object to format
 * @returns Formatted string "DD.MM.YYYY HH:MM"
 */
export function formatBulgarianDateTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${day}.${month}.${year} ${hour}:${minute}`;
}


/**
 * Determines whether a date range is still relevant relative to today.
 *
 * Compares the range's end or start date (if provided) against the current date,
 * normalized to UTC midnight, and returns true if the range is not in the past.
 *
 * @param range - Optional date range with `start` and/or `end` dates.
 * @returns `true` if the range end (or start, if end is absent) is on or after today; otherwise `false`.
 */
export function isDateRelevantLocal(range: { start?: Date; end?: Date } | null): boolean {
  if (!range) return false;

  const today = new Date();

  // Normalize to UTC midnight for comparisons
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const end = range.end ? Date.UTC(range.end.getUTCFullYear(), range.end.getUTCMonth(), range.end.getUTCDate()) : undefined;
  const start = range.start ? Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), range.start.getUTCDate()) : undefined;
  
  if (end !== undefined) return end >= now;
  if (start !== undefined) return start >= now;

  return false;
}
