import type { Message, GeoJSONFeatureCollection, Address } from "@/lib/types";
import {
  convertTimestamp,
  safeJsonParse,
  jsonValidators,
  arrayOf,
} from "@/lib/firestore-utils";

/**
 * Runtime validator for Address shape
 * Validates that an object has all required Address properties
 */
function isAddress(value: unknown): value is Address {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.originalText === "string" &&
    typeof obj.formattedAddress === "string" &&
    typeof obj.coordinates === "object" &&
    obj.coordinates !== null
  );
}

/**
 * Convert Firestore document to public Message object
 * Shared helper to avoid duplication between API routes
 * Returns only public MessageSchema fields
 */
export function docToMessage(doc: FirebaseFirestore.DocumentSnapshot): Message {
  const data = doc.data();
  if (!data) {
    throw new Error(`Document ${doc.id} has no data`);
  }

  return {
    id: doc.id,
    text: data.text,
    plainText: data.plainText,
    addresses: data.addresses
      ? safeJsonParse<Address[]>(
          data.addresses,
          [],
          "addresses",
          arrayOf(isAddress),
        )
      : [],
    geoJson: data.geoJson
      ? safeJsonParse<GeoJSONFeatureCollection>(
          data.geoJson,
          undefined,
          "geoJson",
          jsonValidators.object,
        )
      : undefined,
    crawledAt: data.crawledAt ? convertTimestamp(data.crawledAt) : undefined,
    createdAt: convertTimestamp(data.createdAt),
    finalizedAt: data.finalizedAt
      ? convertTimestamp(data.finalizedAt)
      : undefined,
    source: data.source,
    sourceUrl: data.sourceUrl,
    markdownText: data.markdownText,
    categories: Array.isArray(data.categories) ? data.categories : [],
    timespanStart: data.timespanStart
      ? convertTimestamp(data.timespanStart)
      : undefined,
    timespanEnd: data.timespanEnd
      ? convertTimestamp(data.timespanEnd)
      : undefined,
    cityWide: data.cityWide || false,
    // Denormalized fields (native Firestore types, no parsing needed)
    responsibleEntity: data.responsibleEntity,
    pins: data.pins,
    streets: data.streets,
    cadastralProperties: data.cadastralProperties,
    busStops: data.busStops,
  };
}
