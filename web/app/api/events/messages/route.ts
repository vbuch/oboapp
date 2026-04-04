import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { recordToMessage } from "@/lib/doc-to-message";
import { toRequiredISOString } from "@/lib/date-serialization";
import { MatchSignalsSchema } from "@oboapp/shared";
import type { EventMessage } from "@oboapp/shared";

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function recordToEventMessage(record: Record<string, unknown>): EventMessage {
  const parsedSignals = MatchSignalsSchema.nullable().optional().safeParse(
    record.matchSignals,
  );

  return {
    id: getOptionalString(record._id),
    eventId: getString(record.eventId),
    messageId: getString(record.messageId),
    source: getString(record.source),
    confidence: getNumber(record.confidence, 0),
    geometryQuality: getNumber(record.geometryQuality, 0),
    matchSignals: parsedSignals.success ? parsedSignals.data : undefined,
    createdAt: toRequiredISOString(record.createdAt, "createdAt"),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json(
        { error: "eventId query parameter is required" },
        { status: 400 },
      );
    }

    const db = await getDb();

    // Fetch event-message links
    const eventMessageDocs = await db.eventMessages.findByEventId(eventId);

    if (eventMessageDocs.length === 0) {
      return NextResponse.json({ messages: [], eventMessages: [] });
    }

    // Batch fetch messages
    const messagePromises = eventMessageDocs.map((em) => {
      const messageId = typeof em.messageId === "string" ? em.messageId : null;
      return messageId ? db.messages.findById(messageId) : Promise.resolve(null);
    });
    const messageRecords = await Promise.all(messagePromises);

    // Filter out nulls (deleted messages) and convert
    const messages = messageRecords
      .filter((r): r is Record<string, unknown> => r !== null)
      .map(recordToMessage);

    const eventMessages = eventMessageDocs.map(recordToEventMessage);

    return NextResponse.json({ messages, eventMessages });
  } catch (error) {
    console.error("Error fetching event messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch event messages" },
      { status: 500 },
    );
  }
}
