import type { OboDb } from "@oboapp/db";
import type { GeoJSONFeatureCollection } from "@/lib/types";
import { getSourceTrust, getGeometryQuality } from "@/lib/source-trust";
import { isAlreadyExistsError, toISOString } from "./utils";
import { logger } from "@/lib/logger";

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
): Promise<{ eventId: string; confidence: number; action: "created" | "attached" }> {
  const existingLinks = await db.eventMessages.findByMessageId(message._id);
  if (existingLinks.length > 0) {
    return {
      eventId: existingLinks[0].eventId as string,
      confidence: 1.0,
      action: "attached",
    };
  }

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

  try {
    await db.client.createOne(
      "eventMessages",
      {
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
      },
      message._id,
    );
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw error;
    }

    // Another worker linked this message concurrently. Reuse that link and
    // remove the orphaned event we just created.
    const concurrentLinks = await db.eventMessages.findByMessageId(message._id);
    const concurrentEventId = concurrentLinks[0]?.eventId as string | undefined;

    try {
      await db.events.deleteOne(eventId);
    } catch (deleteError) {
      logger.warn("Failed to delete orphan event after concurrent message link", {
        messageId: message._id,
        orphanEventId: eventId,
        error: deleteError,
      });
    }

    if (!concurrentEventId) {
      throw error;
    }

    return { eventId: concurrentEventId, confidence: 1.0, action: "attached" };
  }

  return { eventId, confidence: 1.0, action: "created" };
}

