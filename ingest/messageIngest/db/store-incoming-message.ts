import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Step 1: Store the incoming message in the database
 */
export async function storeIncomingMessage(
  text: string,
  userId: string,
  userEmail: string | null,
  source: string = "web-interface",
  sourceUrl?: string,
  crawledAt?: Date,
  messageId?: string,
  sourceDocumentId?: string,
): Promise<string> {
  const messagesRef = adminDb.collection("messages");
  const docData: Record<string, unknown> = {
    text,
    userId,
    userEmail,
    source,
    createdAt: FieldValue.serverTimestamp(),
    crawledAt: crawledAt || FieldValue.serverTimestamp(),
  };

  if (sourceUrl) {
    docData.sourceUrl = sourceUrl;
  }

  if (sourceDocumentId) {
    docData.sourceDocumentId = sourceDocumentId;
  }

  // Use deterministic ID if provided, otherwise auto-generate
  if (messageId) {
    await messagesRef.doc(messageId).set(docData);
    return messageId;
  }
  const docRef = await messagesRef.add(docData);
  return docRef.id;
}
