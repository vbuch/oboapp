import type { Firestore } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type { InternalMessage } from "@/lib/types";

/**
 * Get a message by ID
 * Returns InternalMessage with all internal fields
 */
export async function getMessageById(
  messageId: string,
  db: Firestore = adminDb,
): Promise<InternalMessage | null> {
  const messageRef = db.collection("messages").doc(messageId);
  const messageSnapshot = await messageRef.get();

  if (!messageSnapshot.exists) {
    return null;
  }

  const data = messageSnapshot.data();
  if (!data) {
    return null;
  }

  return {
    id: messageSnapshot.id,
    text: data.text,
    locality: data.locality,
    addresses: data.addresses ? JSON.parse(data.addresses) : [],
    geoJson: data.geoJson ? JSON.parse(data.geoJson) : undefined,
    crawledAt: data.crawledAt?.toDate?.() || data.crawledAt,
    createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
    finalizedAt: data.finalizedAt?.toDate?.() || data.finalizedAt,
    source: data.source,
    sourceUrl: data.sourceUrl,
    markdownText: data.markdownText,
    categories: Array.isArray(data.categories) ? data.categories : [],
    timespanStart: data.timespanStart?.toDate?.() || data.timespanStart,
    timespanEnd: data.timespanEnd?.toDate?.() || data.timespanEnd,
    cityWide: data.cityWide || false,
    responsibleEntity: data.responsibleEntity,
    pins: data.pins,
    streets: data.streets,
    cadastralProperties: data.cadastralProperties,
    busStops: data.busStops,
    // Internal-only fields
    process: Array.isArray(data.process) ? data.process : undefined,
    ingestErrors:
      typeof data.ingestErrors === "string"
        ? JSON.parse(data.ingestErrors)
        : data.ingestErrors,
    sourceDocumentId: data.sourceDocumentId,
    isRelevant: data.isRelevant,
  };
}
