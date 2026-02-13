import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isValidMessageId } from "@oboapp/shared";
import { recordToMessage } from "@/lib/doc-to-message";

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

    const db = await getDb();
    const doc = await db.messages.findById(id);

    if (!doc) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const message = recordToMessage(doc);

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Error fetching message by id:", error);
    return NextResponse.json(
      { error: "Failed to fetch message" },
      { status: 500 },
    );
  }
}
