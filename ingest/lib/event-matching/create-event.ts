import type { OboDb } from "@oboapp/db";
import type { GeoJSONFeatureCollection } from "@/lib/types";
import { getSourceTrust, getGeometryQuality } from "@/lib/source-trust";
import { toISOString } from "./utils";

/**
 * Create a new event from a message that didn't match any existing event.
 * Also creates the EventMessage link and returns the new event ID.
 */
export async function createEventFromMessage(
  db: OboDb,
  message: {
    _id: string;
    plainText?: string;
    text?: string;
    markdownText?: string;
    geoJson?: GeoJSONFeatureCollection | null;
    timespanStart?: string | Date | null;
    timespanEnd?: string | Date | null;
    categories?: string[];
    source?: string;
    locality?: string;
    cityWide?: boolean;
    embedding?: number[] | null;
  },
): Promise<{ eventId: string; confidence: number }> {
  const source = (message.source as string) || "";
  const hasGeoJson = Boolean(message.geoJson);
  let geometryQuality = 0;
  if (hasGeoJson) {
    const isPrecomputedSource = getSourceTrust(source).geometryQuality === 3;
    geometryQuality = getGeometryQuality(source, isPrecomputedSource);
  }
  const now = new Date().toISOString();

  const eventId = await db.events.insertOne({
    canonicalText: message.plainText || message.text || "",
    canonicalMarkdownText: message.markdownText || null,
    geometry: message.geoJson || null,
    geometryQuality,
    timespanStart: message.timespanStart
      ? toISOString(message.timespanStart)
      : null,
    timespanEnd: message.timespanEnd
      ? toISOString(message.timespanEnd)
      : null,
    categories: message.categories || [],
    sources: source ? [source] : [],
    messageCount: 1,
    confidence: 1.0,
    locality: message.locality || "bg.sofia",
    cityWide: message.cityWide || false,
    ...(message.embedding && { embedding: message.embedding }),
    createdAt: now,
    updatedAt: now,
  });

  await db.eventMessages.insertOne({
    eventId,
    messageId: message._id,
    source,
    confidence: 1.0,
    geometryQuality,
    matchSignals: {
      locationSimilarity: 1.0,
      timeOverlap: 1.0,
      categoryMatch: 1.0,
      textSimilarity: 1.0,
    },
    createdAt: now,
  });

  return { eventId, confidence: 1.0 };
}

