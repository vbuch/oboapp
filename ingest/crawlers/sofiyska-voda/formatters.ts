/**
 * Text sanitization and formatting utilities
 */

/**
 * Sanitize text by removing extra whitespace and trimming
 */
export function sanitizeText(text?: string | null): string | null {
  if (!text) return null;
  const trimmed = text.replaceAll(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Ensure a timestamp is converted to a valid Date or null
 */
export function ensureDate(timestamp?: number | null): Date | null {
  if (!timestamp && timestamp !== 0) {
    return null;
  }

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format a date using Bulgarian locale
 */
export function formatDate(
  date?: Date | null,
  formatter?: Intl.DateTimeFormat
): string | null {
  if (!date) return null;

  const defaultFormatter = new Intl.DateTimeFormat("bg-BG", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Sofia",
  });

  return (formatter ?? defaultFormatter).format(date);
}
