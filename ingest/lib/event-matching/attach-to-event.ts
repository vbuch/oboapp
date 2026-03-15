import type { OboDb, UpdateOperators } from "@oboapp/db";
import type { GeoJSONFeatureCollection } from "@/lib/types";
import { getSourceTrust, getGeometryQuality } from "@/lib/source-trust";
import type { MatchSignals } from "./score";
import { toISOString, toMs, isAlreadyExistsError } from "./utils";
import { logger } from "@/lib/logger";

/**
 * Attach a message to an existing event.
 * Updates the event: merge timespans, upgrade geometry if better quality,
 * add source, increment messageCount, update confidence.
 *
 * Uses atomic operators ($inc, $addToSet) for concurrency-safe updates.
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
  // Geometry quality is 0 when the message has no geoJson (e.g., city-wide messages)
  const newGeometryQuality = message.geoJson
    ? getGeometryQuality(source, hasPrecomputedGeoJson)
    : 0;
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

  // Build atomic event update using UpdateOperators for concurrency safety
  const setFields: Record<string, unknown> = { updatedAt: now };
  const addToSet: Record<string, unknown> = {};

  // Merge timespans (expand to union)
  if (message.timespanStart) {
    const msgStart = toMs(message.timespanStart);
    const evtStart = event.timespanStart ? toMs(event.timespanStart as string) : Infinity;
    if (msgStart < evtStart) {
      setFields.timespanStart = toISOString(message.timespanStart);
    }
  }
  if (message.timespanEnd) {
    const msgEnd = toMs(message.timespanEnd);
    const evtEnd = event.timespanEnd ? toMs(event.timespanEnd as string) : -Infinity;
    if (msgEnd > evtEnd) {
      setFields.timespanEnd = toISOString(message.timespanEnd);
    }
  }

  // Add source atomically (dedup handled by arrayUnion/$addToSet)
  if (source) {
    addToSet.sources = source;
  }

  // Add categories atomically (union via arrayUnion/$addToSet)
  if (message.categories?.length) {
    addToSet.categories = message.categories;
  }

  // Update embedding if new source has higher trust
  if (message.embedding?.length) {
    const existingSources = (event.sources as string[]) ?? [];
    const newTrust = getSourceTrust(source).trust;
    const existingPrimarySource = existingSources[0] ?? "";
    const existingTrust = getSourceTrust(existingPrimarySource).trust;
    if (newTrust >= existingTrust || !event.embedding) {
      setFields.embedding = message.embedding;
    }
  }

  const atomicUpdate: UpdateOperators = {
    $inc: { messageCount: 1 },
    $set: setFields,
    ...(Object.keys(addToSet).length > 0 && { $addToSet: addToSet }),
  };

  await db.events.updateOne(eventId, atomicUpdate);

  // Geometry upgrade: separate step with fresh read to minimize stale-data window.
  // Re-read the event to get the latest geometryQuality before overwriting.
  if (message.geoJson && newGeometryQuality > 0) {
    const existingGeometryQuality = (event.geometryQuality as number) ?? 0;
    if (newGeometryQuality > existingGeometryQuality) {
      const freshEvent = await db.events.findById(eventId);
      const latestGeometryQuality = (freshEvent?.geometryQuality as number) ?? 0;
      if (newGeometryQuality > latestGeometryQuality) {
        await db.events.updateOne(eventId, {
          $set: { geoJson: message.geoJson, geometryQuality: newGeometryQuality },
        });
      }
    }
  }
}
