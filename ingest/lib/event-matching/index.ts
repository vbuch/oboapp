import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { findBestMatch } from "./match";
import { createEventFromMessage } from "./create-event";
import { attachMessageToEvent } from "./attach-to-event";
import type { GeoJSONFeatureCollection } from "@/lib/types";

export { computeMatchScore, type MatchSignals } from "./score";
export { findCandidateEvents } from "./candidates";
export { findBestMatch } from "./match";
export { createEventFromMessage } from "./create-event";
export { attachMessageToEvent } from "./attach-to-event";
export { preGeocodeMatch, type PreGeocodeMatchResult } from "./pre-geocode-match";

export interface EventMatchResult {
  eventId: string;
  action: "created" | "attached";
  confidence: number;
}

/**
 * Main entry point for event matching.
 * Called after a message is finalized with geoJson.
 * Either creates a new event or attaches the message to an existing one.
 */
export async function processEventMatching(
  message: Record<string, unknown>,
): Promise<EventMatchResult> {
  const db = await getDb();
  const messageId = message._id as string;

  const matchInput = {
    geoJson: message.geoJson as GeoJSONFeatureCollection | null,
    timespanStart: message.timespanStart as string | null,
    timespanEnd: message.timespanEnd as string | null,
    categories: message.categories as string[] | undefined,
    cityWide: message.cityWide as boolean | undefined,
    locality: (message.locality as string) || "bg.sofia",
    embedding: message.embedding as number[] | undefined,
  };

  const bestMatch = await findBestMatch(db, matchInput);

  if (bestMatch) {
    const eventId = bestMatch.event._id as string;

    await attachMessageToEvent(
      db,
      {
        _id: messageId,
        geoJson: message.geoJson as GeoJSONFeatureCollection | null,
        timespanStart: message.timespanStart as string | null,
        timespanEnd: message.timespanEnd as string | null,
        source: message.source as string | undefined,
        categories: message.categories as string[] | undefined,
        embedding: message.embedding as number[] | undefined,
      },
      bestMatch.event,
      bestMatch.score,
      bestMatch.signals,
    );

    logger.info("Message attached to existing event", {
      messageId,
      eventId,
      confidence: bestMatch.score,
    });

    return { eventId, action: "attached", confidence: bestMatch.score };
  }

  // No match found — create a new event
  const { eventId, confidence } = await createEventFromMessage(db, {
    _id: messageId,
    plainText: message.plainText as string | undefined,
    text: message.text as string | undefined,
    markdownText: message.markdownText as string | undefined,
    geoJson: message.geoJson as GeoJSONFeatureCollection | null,
    timespanStart: message.timespanStart as string | null,
    timespanEnd: message.timespanEnd as string | null,
    categories: message.categories as string[] | undefined,
    source: message.source as string | undefined,
    locality: (message.locality as string) || "bg.sofia",
    cityWide: message.cityWide as boolean | undefined,
    embedding: message.embedding as number[] | undefined,
  });

  logger.info("New event created for message", {
    messageId,
    eventId,
  });

  return { eventId, action: "created", confidence };
}
