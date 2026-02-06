import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { isValidSlug } from "@oboapp/shared";
import { docToMessage } from "@/lib/doc-to-message";

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

    // Query Firestore for message with this slug
    const messagesRef = adminDb.collection("messages");
    const snapshot = await messagesRef.where("slug", "==", slug).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const message = docToMessage(snapshot.docs[0]);

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Error fetching message by slug:", error);
    return NextResponse.json(
      { error: "Failed to fetch message" },
      { status: 500 },
    );
  }
}
