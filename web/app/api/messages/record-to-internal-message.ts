import type { InternalMessage, IngestError } from "@/lib/types";
import {
  toOptionalISOString,
  toRequiredISOString,
} from "@/lib/date-serialization";

export function recordToInternalMessage(
  record: Record<string, unknown>,
): InternalMessage {
  return {
    id: record._id as string,
    text: record.text as string,
    locality: (record.locality as string) ?? "",
    plainText: record.plainText as string | undefined,
    markdownText: record.markdownText as string | undefined,
    addresses: (record.addresses as InternalMessage["addresses"]) ?? [],
    geoJson: record.geoJson as InternalMessage["geoJson"],
    crawledAt: toOptionalISOString(record.crawledAt, "crawledAt"),
    createdAt: toRequiredISOString(record.createdAt, "createdAt"),
    finalizedAt: toOptionalISOString(record.finalizedAt, "finalizedAt"),
    source: record.source as string | undefined,
    sourceUrl: record.sourceUrl as string | undefined,
    categories: Array.isArray(record.categories) ? record.categories : [],
    timespanStart: toOptionalISOString(record.timespanStart, "timespanStart"),
    timespanEnd: toOptionalISOString(record.timespanEnd, "timespanEnd"),
    cityWide: (record.cityWide as boolean) || false,
    responsibleEntity: record.responsibleEntity as string | undefined,
    pins: Array.isArray(record.pins) ? record.pins : undefined,
    streets: Array.isArray(record.streets) ? record.streets : undefined,
    cadastralProperties: Array.isArray(record.cadastralProperties)
      ? record.cadastralProperties
      : undefined,
    busStops: Array.isArray(record.busStops) ? record.busStops : undefined,
    // Internal-only fields
    process: Array.isArray(record.process) ? record.process : undefined,
    ingestErrors: Array.isArray(record.ingestErrors)
      ? (record.ingestErrors as IngestError[])
      : undefined,
    isRelevant: record.isRelevant as boolean | undefined,
    isUnreadable: record.isUnreadable as boolean | undefined,
  };
}
