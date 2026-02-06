import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { Message } from "@/lib/types";
import { convertTimestamp } from "@/lib/firestore-utils";
import { isValidSlug } from "@/lib/slug-utils";

/**
 * Convert Firestore document to Message object
 * Returns only public MessageSchema fields
 */
function docToMessage(doc: FirebaseFirestore.DocumentSnapshot): Message {
  const data = doc.data();
  if (!data) {
    throw new Error(`Document ${doc.id} has no data`);
  }

  return {
    id: doc.id,
    slug: data.slug,
    text: data.text,
    addresses: data.addresses ? JSON.parse(data.addresses) : [],
    geoJson: data.geoJson ? JSON.parse(data.geoJson) : undefined,
    crawledAt: data.crawledAt ? convertTimestamp(data.crawledAt) : undefined,
    createdAt: convertTimestamp(data.createdAt),
    finalizedAt: data.finalizedAt
      ? convertTimestamp(data.finalizedAt)
      : undefined,
    source: data.source,
    sourceUrl: data.sourceUrl,
    markdownText: data.markdownText,
    categories: Array.isArray(data.categories) ? data.categories : [],
    timespanStart: data.timespanStart
      ? convertTimestamp(data.timespanStart)
      : undefined,
    timespanEnd: data.timespanEnd
      ? convertTimestamp(data.timespanEnd)
      : undefined,
    cityWide: data.cityWide || false,
    // Denormalized fields (native Firestore types, no parsing needed)
    responsibleEntity: data.responsibleEntity,
    pins: data.pins,
    streets: data.streets,
    cadastralProperties: data.cadastralProperties,
    busStops: data.busStops,
  };
}

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
