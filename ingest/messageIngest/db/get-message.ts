import { getDb } from "@/lib/db";
import type { InternalMessage } from "@/lib/types";

function toISOString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function toOptionalISOString(value: unknown): string | undefined {
  if (!value) return undefined;
  return toISOString(value);
}

/**
 * Get a message by ID.
 * Returns InternalMessage with all internal fields.
 * The db adapter handles deserialization (parses JSON strings from Firestore,
 * native objects from MongoDB).
 */
export async function getMessageById(
  messageId: string,
): Promise<InternalMessage | null> {
  const db = await getDb();
  const data = await db.messages.findById(messageId);

  if (!data) {
    return null;
  }

  return {
    id: data._id as string,
    text: data.text as string,
    locality: (data.locality as string) ?? "",
    addresses: Array.isArray(data.addresses) ? data.addresses : [],
    geoJson: data.geoJson as InternalMessage["geoJson"],
    crawledAt: toOptionalISOString(data.crawledAt),
    createdAt: toISOString(data.createdAt),
    finalizedAt: toOptionalISOString(data.finalizedAt),
    source: data.source as string,
    sourceUrl: data.sourceUrl as string | undefined,
    markdownText: data.markdownText as string | undefined,
    categories: Array.isArray(data.categories) ? data.categories : [],
    timespanStart: toOptionalISOString(data.timespanStart),
    timespanEnd: toOptionalISOString(data.timespanEnd),
    cityWide: (data.cityWide as boolean) || false,
    responsibleEntity: data.responsibleEntity as string | undefined,
    pins: data.pins as InternalMessage["pins"],
    streets: data.streets as InternalMessage["streets"],
    cadastralProperties: data.cadastralProperties as InternalMessage["cadastralProperties"],
    busStops: data.busStops as InternalMessage["busStops"],
    // Internal-only fields
    process: Array.isArray(data.process) ? data.process : undefined,
    ingestErrors: Array.isArray(data.ingestErrors) ? data.ingestErrors : undefined,
    sourceDocumentId: data.sourceDocumentId as string | undefined,
    isRelevant: data.isRelevant as boolean | undefined,
  };
}
