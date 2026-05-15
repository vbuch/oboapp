import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isValidMessageId } from "@oboapp/shared";
import { recordToInternalMessage } from "@/lib/doc-to-message";

/**
 * Strip a trailing split-index suffix (e.g. "-1", "-2") from a
 * source-document-style ID so we can query by sourceDocumentId.
 */
function stripSplitSuffix(id: string): string {
  return id.replace(/-\d+$/, "");
}

/**
 * Fetch a message by its ID.
 *
 * Primary lookup: 8-char alphanumeric message ID (used in /m/{id} URLs).
 * Fallback lookup: sourceDocumentId (base64-encoded source URL, optionally
 * with a "-N" split-index suffix) — supports legacy and external callers
 * that reference messages by their source document identifier.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing id parameter" },
        { status: 400 },
      );
    }

    const db = await getDb();

    // Primary: look up by 8-char message ID
    if (isValidMessageId(id)) {
      const doc = await db.messages.findById(id);
      if (doc) {
        return NextResponse.json({ message: recordToInternalMessage(doc) });
      }
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Fallback: treat the id as a sourceDocumentId (strip optional "-N" suffix)
    const sourceDocId = stripSplitSuffix(id);
    const docs = await db.messages.findBySourceDocumentIds([sourceDocId]);

    if (docs.length > 0) {
      return NextResponse.json({ message: recordToInternalMessage(docs[0]) });
    }

    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  } catch (error) {
    console.error("Error fetching message by id:", error);
    return NextResponse.json(
      { error: "Failed to fetch message" },
      { status: 500 },
    );
  }
}
