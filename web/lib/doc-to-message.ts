import type { Message, GeoJSONFeatureCollection, Address } from "@/lib/types";
import { convertTimestamp, safeJsonParse } from "@/lib/firestore-utils";

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
    locality: data.locality,
    plainText: data.plainText,
    addresses: data.addresses
      ? safeJsonParse<Address[]>(data.addresses, [], "addresses")
      : [],
    geoJson: data.geoJson
      ? safeJsonParse<GeoJSONFeatureCollection>(
          data.geoJson,
          undefined,
          "geoJson",
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
