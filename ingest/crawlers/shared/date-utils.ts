import { logger } from "@/lib/logger";

const BULGARIAN_MONTH_TO_NUMBER: Record<string, number> = {
  януари: 1,
  февруари: 2,
  март: 3,
  април: 4,
  май: 5,
  юни: 6,
  юли: 7,
  август: 8,
  септември: 9,
  октомври: 10,
  ноември: 11,
  декември: 12,
};

/**
 * Parse Bulgarian date format (DD.MM.YYYY, DD.MM.YY, or DD/MM/YYYY) to ISO string
 * Supports both 2-digit (YY) and 4-digit (YYYY) years
 */
export function parseBulgarianDate(dateStr: string): string {
  try {
    // Format: "19.12.2025" or "19/12/2025" or "17.07.25"
    // Handle both dot and slash separators
    const normalized = dateStr.trim().replaceAll("/", ".");
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
    logger.error("Error parsing date", {
      dateStr,
      error: error instanceof Error ? error.message : String(error),
    });
    return new Date().toISOString();
  }
}

/**
 * Parse Bulgarian short date format with 2-digit year (DD.MM.YY) to ISO string
 * Optionally combines with time (HH:MM)
 *
 * @param dateStr - Date string in format "DD.MM.YY" (e.g., "17.07.25")
 * @param timeStr - Optional time string in format "HH:MM" (e.g., "18:48")
 * @returns ISO date string
 *
 */
export function parseShortBulgarianDateTime(
  dateStr: string,
  timeStr?: string,
): string {
  try {
    // Format: "DD.MM.YY" optionally with "HH:MM"
    const normalized = dateStr.trim().replaceAll("/", ".");
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

    logger.warn("Unable to parse short date, using current date", {
      dateStr,
      timeStr: timeStr || "",
    });
    return new Date().toISOString();
  } catch (error) {
    logger.error("Error parsing short date", {
      dateStr,
      timeStr: timeStr || "",
      error: error instanceof Error ? error.message : String(error),
    });
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
    // Clean and normalize the input
    const cleaned = dateStr.trim();

    // Match pattern: "DD Month YYYY" (e.g., "20 Октомври 2025")
    const match = /^(\d{1,2})\s+(\S+)\s+(\d{4})$/.exec(cleaned);

    if (!match) {
      logger.warn("Unable to parse Bulgarian month date, using current date", {
        dateStr,
      });
      return new Date().toISOString();
    }

    const [, day, monthName, year] = match;
    const monthLower = monthName.toLowerCase();
    const month = BULGARIAN_MONTH_TO_NUMBER[monthLower];

    if (!month) {
      logger.warn("Unknown Bulgarian month name, using current date", {
        monthName,
      });
      return new Date().toISOString();
    }
    const date = new Date(
      Number.parseInt(year, 10),
      month - 1, // 0-indexed months
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
    const parsedMonth = month - 1; // 0-indexed
    const parsedYear = Number.parseInt(year, 10);

    if (
      date.getDate() !== parsedDay ||
      date.getMonth() !== parsedMonth ||
      date.getFullYear() !== parsedYear
    ) {
      logger.warn("Invalid date (out of range), using current date", {
        dateStr,
      });
      return new Date().toISOString();
    }

    return date.toISOString();
  } catch (error) {
    logger.error("Error parsing Bulgarian month date", {
      dateStr,
      error: error instanceof Error ? error.message : String(error),
    });
    return new Date().toISOString();
  }
}
