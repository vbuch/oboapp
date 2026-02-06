import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { generateUniqueMessageId } from "@/lib/slug-utils";

/**
 * Step 1: Store the incoming message in the database
 * Always uses an 8-character slug-format ID as the document ID.
 * The document ID doubles as the URL slug (e.g., /m/aB3xYz12).
 */
export async function storeIncomingMessage(
  text: string,
  userId: string,
  userEmail: string | null,
  source: string = "web-interface",
  sourceUrl?: string,
  crawledAt?: Date,
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

  const messageId = await generateUniqueMessageId();
  await messagesRef.doc(messageId).set(docData);
  return messageId;
}
