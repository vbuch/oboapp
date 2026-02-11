import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { Message, GeoJSONFeatureCollection, Address } from "@/lib/types";
import { convertTimestamp, safeJsonParse } from "@/lib/firestore-utils";

const DEFAULT_RELEVANCE_DAYS = 7;

export async function GET(request: Request) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get("sourceId");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 12;

    if (!sourceId) {
      return NextResponse.json(
        { error: "sourceId parameter is required" },
        { status: 400 },
      );
    }

    // Get relevance period from environment
    const relevanceDays = process.env.MESSAGE_RELEVANCE_DAYS
      ? Number.parseInt(process.env.MESSAGE_RELEVANCE_DAYS, 10)
      : DEFAULT_RELEVANCE_DAYS;

    // Calculate cutoff date for timespan filtering
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - relevanceDays);

    // Query messages by source
    const messagesRef = adminDb.collection("messages");
    const snapshot = await messagesRef
      .where("source", "==", sourceId)
      .where("timespanEnd", ">=", cutoffDate)
      .orderBy("timespanEnd", "desc")
      .limit(limit)
      .get();

    const messages: Message[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        text: data.text,
        locality: data.locality,
        markdownText: data.markdownText,
        addresses: data.addresses
          ? safeJsonParse<Address[]>(data.addresses, [], "addresses")
          : [],
        geoJson: data.geoJson
          ? safeJsonParse<GeoJSONFeatureCollection>(
              data.geoJson,
              undefined,
              "geoJson",
            )
          : undefined,
        createdAt: convertTimestamp(data.createdAt),
        crawledAt: data.crawledAt
          ? convertTimestamp(data.crawledAt)
          : undefined,
        finalizedAt: data.finalizedAt
          ? convertTimestamp(data.finalizedAt)
          : undefined,
        source: data.source,
        sourceUrl: data.sourceUrl,
        categories: Array.isArray(data.categories) ? data.categories : [],
        timespanStart: data.timespanStart
          ? convertTimestamp(data.timespanStart)
          : undefined,
        timespanEnd: data.timespanEnd
          ? convertTimestamp(data.timespanEnd)
          : undefined,
        cityWide: data.cityWide || false,
        responsibleEntity: data.responsibleEntity,
        pins: Array.isArray(data.pins) ? data.pins : undefined,
        streets: Array.isArray(data.streets) ? data.streets : undefined,
        cadastralProperties: Array.isArray(data.cadastralProperties)
          ? data.cadastralProperties
          : undefined,
        busStops: Array.isArray(data.busStops) ? data.busStops : undefined,
      });
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Error fetching messages by source:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 },
    );
  }
}
