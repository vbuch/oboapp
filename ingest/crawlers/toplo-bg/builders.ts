import type { ToploIncidentInfo } from "./types";

/**
 * Format a date for display in Bulgarian locale
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleString("bg-BG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Build message text from incident information
 */
export function buildMessage(
  name: string,
  fromDate: string,
  addresses: string,
  untilDate: string | null
): string {
  const parts = [name, "", formatDate(fromDate), addresses];

  if (untilDate) {
    parts.push("", `Очаквано възстановяване на ${formatDate(untilDate)}`);
  }

  return parts.join("\n");
}

/**
 * Build URL for an incident
 */
export function buildUrl(contentItemId: string): string {
  return `https://toplo.bg/incidents/${contentItemId}`;
}

/**
 * Build title from incident info (using name)
 */
export function buildTitle(info: ToploIncidentInfo): string {
  return info.Name;
}
