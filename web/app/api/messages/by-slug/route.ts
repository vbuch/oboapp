import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { isValidSlug } from "@oboapp/shared";
import { docToMessage } from "@/lib/doc-to-message";

/**
 * Fetch a message by its ID (which is a slug-format identifier).
 * Supports /m/{slug} external URLs via the redirect in /m/[slug]/page.tsx.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json(
        { error: "Missing slug parameter" },
        { status: 400 },
      );
    }

    if (!isValidSlug(slug)) {
      return NextResponse.json({ error: "Invalid slug format" }, { status: 400 });
    }

    // Slug IS the document ID — direct lookup, no query needed
    const doc = await adminDb.collection("messages").doc(slug).get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const message = docToMessage(doc);

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Error fetching message by slug:", error);
    return NextResponse.json(
      { error: "Failed to fetch message" },
      { status: 500 },
    );
  }
}
