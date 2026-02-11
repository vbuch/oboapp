import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { generateMessageId } from "@/lib/message-id-utils";

/**
 * Maximum number of attempts to generate a unique message ID before failing.
 * With 62^8 possible combinations, collisions are extremely rare.
 */
const MAX_MESSAGE_ID_GENERATION_ATTEMPTS = 5;

/**
 * Firestore error codes for document already exists.
 * Different Firestore SDK versions may use different formats.
 * Includes both string codes and numeric code 6.
 */
const FIRESTORE_ALREADY_EXISTS_CODES = new Set([
  "already-exists",
  "ALREADY_EXISTS",
  6, // Numeric code for ALREADY_EXISTS
]);

/**
 * Step 1: Store the incoming message in the database
 * Always uses an 8-character alphanumeric ID as the document ID.
 * The document ID is used in URLs (e.g., /m/aB3xYz12).
 */
export async function storeIncomingMessage(
  text: string,
  userId: string,
  userEmail: string | null,
  locality: string,
  source: string = "web-interface",
  sourceUrl?: string,
  crawledAt?: Date,
  sourceDocumentId?: string,
): Promise<string> {
  const messagesRef = adminDb.collection("messages");
  const docData: Record<string, unknown> = {
    text,
    userId,
    locality,
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

  // Atomically create document with retry on collision
  for (
    let attempt = 0;
    attempt < MAX_MESSAGE_ID_GENERATION_ATTEMPTS;
    attempt++
  ) {
    const messageId = generateMessageId();
    try {
      await messagesRef.doc(messageId).create(docData);
      return messageId;
    } catch (err: unknown) {
      // If the document already exists, retry with a new ID
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (typeof err.code === "string" || typeof err.code === "number") &&
        FIRESTORE_ALREADY_EXISTS_CODES.has(err.code)
      ) {
        continue;
      }
      throw err;
    }
  }

  throw new Error(
    "Failed to generate a unique message ID after multiple attempts.",
  );
}
