import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { isValidMessageId } from "@oboapp/shared";
import { docToMessage } from "@/lib/doc-to-message";

/**
 * Fetch a message by its ID.
 * Supports /m/{id} external URLs via the redirect in /m/[id]/page.tsx.
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

    if (!isValidMessageId(id)) {
      return NextResponse.json({ error: "Invalid id format" }, { status: 400 });
    }

    // Message ID IS the document ID — direct lookup, no query needed
    const doc = await adminDb.collection("messages").doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const message = docToMessage(doc);

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Error fetching message by id:", error);
    return NextResponse.json(
      { error: "Failed to fetch message" },
      { status: 500 },
    );
  }
}
