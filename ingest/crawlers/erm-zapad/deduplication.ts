import type { PinRecord } from "./types";

/**
 * Deduplicate pin records by unique combination of properties
 * When duplicates exist, keep the one with the lowest eventId (sorted alphanumerically)
 */
export function deduplicatePinRecords(records: PinRecord[]): PinRecord[] {
  const uniqueMap = new Map<string, PinRecord>();

  for (const record of records) {
    // Create deduplication key from all unique properties
    // Use toFixed to ensure consistent string representation of coordinates
    const key = `${record.lat.toFixed(6)},${record.lon.toFixed(6)},${record.typedist},${record.begin_event},${record.end_event},${record.city_name},${record.cities}`;

    const existing = uniqueMap.get(key);
    if (existing && record.eventId >= existing.eventId) {
      // Keep existing record (has lower eventId)
      continue;
    }
    // Set new record (either first one or has lower eventId)
    uniqueMap.set(key, record);
  }

  return Array.from(uniqueMap.values());
}
