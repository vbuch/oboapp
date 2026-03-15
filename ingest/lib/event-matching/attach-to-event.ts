import type { OboDb } from "@oboapp/db";
import type { GeoJSONFeatureCollection } from "@/lib/types";
import { getSourceTrust, getGeometryQuality } from "@/lib/source-trust";
import type { MatchSignals } from "./score";
import { toISOString, toMs, isAlreadyExistsError } from "./utils";
import { logger } from "@/lib/logger";

/**
 * Attach a message to an existing event.
 * Updates the event: merge timespans, upgrade geometry if better quality,
 * add source, increment messageCount, update confidence.
 */
export async function attachMessageToEvent(
  db: OboDb,
  message: {
    _id: string;
    geoJson?: GeoJSONFeatureCollection | null;
    timespanStart?: string | Date | null;
    timespanEnd?: string | Date | null;
    source?: string;
    categories?: string[];
    embedding?: number[] | null;
  },
  event: Record<string, unknown>,
  confidence: number,
  signals: MatchSignals,
): Promise<void> {
  const existingLinks = await db.eventMessages.findByMessageId(message._id);
  if (existingLinks.length > 0) {
    logger.info("Message already linked to an event, skipping duplicate attach", {
      messageId: message._id,
      existingEventId: existingLinks[0].eventId,
      attemptedEventId: event._id,
    });
    return;
  }

  const source = (message.source as string) || "";
  const hasPrecomputedGeoJson = getSourceTrust(source).geometryQuality === 3;
  const newGeometryQuality = getGeometryQuality(source, hasPrecomputedGeoJson);
  const now = new Date().toISOString();
  const eventId = event._id as string;

  // Create EventMessage link
  try {
    await db.eventMessages.createOne(
      {
        eventId,
        messageId: message._id,
        source,
        confidence,
        geometryQuality: newGeometryQuality,
        matchSignals: signals,
        createdAt: now,
      },
      message._id,
    );
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      logger.info("Message link created concurrently, skipping duplicate attach", {
        messageId: message._id,
        attemptedEventId: eventId,
      });
      return;
    }
    throw error;
  }

  // Build event update
  const existingGeometryQuality = (event.geometryQuality as number) ?? 0;
  const existingSources = (event.sources as string[]) ?? [];
  const existingMessageCount = (event.messageCount as number) ?? 1;

  const update: Record<string, unknown> = {
    messageCount: existingMessageCount + 1,
    updatedAt: now,
  };

  // Merge timespans (expand to union)
  if (message.timespanStart) {
    const msgStart = toMs(message.timespanStart);
    const evtStart = event.timespanStart ? toMs(event.timespanStart as string) : Infinity;
    if (msgStart < evtStart) {
      update.timespanStart = toISOString(message.timespanStart);
    }
  }
  if (message.timespanEnd) {
    const msgEnd = toMs(message.timespanEnd);
    const evtEnd = event.timespanEnd ? toMs(event.timespanEnd as string) : -Infinity;
    if (msgEnd > evtEnd) {
      update.timespanEnd = toISOString(message.timespanEnd);
    }
  }

  // Upgrade geometry if new message has higher quality
  if (newGeometryQuality > existingGeometryQuality && message.geoJson) {
    update.geoJson = message.geoJson;
    update.geometryQuality = newGeometryQuality;
  }

  // Add source if not already present
  if (source && !existingSources.includes(source)) {
    update.sources = [...existingSources, source];
  }

  // Merge categories (union)
  const msgCategories = message.categories;
  if (msgCategories?.length) {
    const existingCategories = (event.categories as string[]) ?? [];
    const merged = [...new Set([...existingCategories, ...msgCategories])];
    if (merged.length > existingCategories.length) {
      update.categories = merged;
    }
  }

  // Update embedding if new source has higher trust
  if (message.embedding?.length) {
    const newTrust = getSourceTrust(source).trust;
    const existingPrimarySource = existingSources[0] ?? "";
    const existingTrust = getSourceTrust(existingPrimarySource).trust;
    if (newTrust >= existingTrust || !event.embedding) {
      update.embedding = message.embedding;
    }
  }

  await db.events.updateOne(eventId, update);
}
