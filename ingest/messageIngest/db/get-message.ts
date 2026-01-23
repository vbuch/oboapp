import type { Firestore } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type { Message } from "@/lib/types";

/**
 * Get a message by ID
 */
export async function getMessageById(
  messageId: string,
  db: Firestore = adminDb,
): Promise<Message | null> {
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
    addresses: data.addresses ? JSON.parse(data.addresses) : [],
    extractedData: data.extractedData
      ? JSON.parse(data.extractedData)
      : undefined,
    geoJson: data.geoJson ? JSON.parse(data.geoJson) : undefined,
    createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
    crawledAt: data.crawledAt?.toDate?.() || data.crawledAt,
    finalizedAt: data.finalizedAt?.toDate?.() || data.finalizedAt,
    source: data.source,
    sourceUrl: data.sourceUrl,
    categories: Array.isArray(data.categories) ? data.categories : [],
    timespanStart: data.timespanStart?.toDate?.() || data.timespanStart,
    timespanEnd: data.timespanEnd?.toDate?.() || data.timespanEnd,
  };
}
