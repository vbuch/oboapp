import { getDb } from "@/lib/db";

/**
 * Update message document with multiple fields.
 * The db adapter handles serialization (stringify geoJson/addresses for Firestore,
 * native objects for MongoDB).
 *
 * @param messageId - The message document ID
 * @param fields - Object containing fields to update
 */
export async function updateMessage(
  messageId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const db = await getDb();
  await db.messages.updateOne(messageId, fields);
}
