import type { Message } from "@/lib/types";

/**
 * Convert a database record to a public Message object.
 * The @oboapp/db adapter handles JSON parsing and Timestamp→Date conversion,
 * so this function only needs to map fields and convert Dates to ISO strings.
 */

function toISOString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function toOptionalISOString(value: unknown): string | undefined {
  if (!value) return undefined;
  return toISOString(value);
}

export function recordToMessage(record: Record<string, unknown>): Message {
  return {
    id: record._id as string,
    text: record.text as string,
    locality: (record.locality as string) ?? "",
    plainText: record.plainText as string | undefined,
    addresses: (record.addresses as Message["addresses"]) ?? [],
    geoJson: record.geoJson as Message["geoJson"],
    crawledAt: toOptionalISOString(record.crawledAt),
    createdAt: toISOString(record.createdAt),
    finalizedAt: toOptionalISOString(record.finalizedAt),
    source: record.source as string | undefined,
    sourceUrl: record.sourceUrl as string | undefined,
    markdownText: record.markdownText as string | undefined,
    categories: Array.isArray(record.categories) ? record.categories : [],
    timespanStart: toOptionalISOString(record.timespanStart),
    timespanEnd: toOptionalISOString(record.timespanEnd),
    cityWide: (record.cityWide as boolean) || false,
    responsibleEntity: record.responsibleEntity as string | undefined,
    pins: record.pins as Message["pins"],
    streets: record.streets as Message["streets"],
    cadastralProperties: record.cadastralProperties as Message["cadastralProperties"],
    busStops: record.busStops as Message["busStops"],
  };
}
