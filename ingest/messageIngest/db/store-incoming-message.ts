import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { generateSlug } from "@/lib/slug-utils";

/**
 * Maximum number of attempts to generate a unique message ID before failing.
 * With 62^8 possible combinations, collisions are extremely rare.
 */
const MAX_MESSAGE_ID_GENERATION_ATTEMPTS = 5;

/**
 * Firestore error codes for document already exists.
 * Different Firestore SDK versions may use different formats.
 */
const FIRESTORE_ALREADY_EXISTS_CODES = ["already-exists", "ALREADY_EXISTS"];

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

  // Atomically create document with retry on collision
  for (let attempt = 0; attempt < MAX_MESSAGE_ID_GENERATION_ATTEMPTS; attempt++) {
    const messageId = generateSlug();
    try {
      await messagesRef.doc(messageId).create(docData);
      return messageId;
    } catch (err: unknown) {
      // If the document already exists, retry with a new ID
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        typeof err.code === "string" &&
        FIRESTORE_ALREADY_EXISTS_CODES.includes(err.code)
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
