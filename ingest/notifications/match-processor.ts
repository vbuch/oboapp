import type { OboDb } from "@oboapp/db";
import type { Message, Interest, NotificationMatch } from "@/lib/types";
import { matchMessageToInterest } from "./geo-matcher";
import { logger } from "@/lib/logger";

export interface MatchResult {
  messageId: string;
  userId: string;
  interestId: string;
  distance: number;
}

/**
 * Match unprocessed messages with user interests
 */
export async function matchMessagesWithInterests(
  messages: Message[],
  interests: Interest[],
): Promise<MatchResult[]> {
  logger.info("Matching messages with interests");

  const matches: MatchResult[] = [];

  for (const message of messages) {
    if (!message.id || !message.geoJson) {
      continue;
    }

    for (const interest of interests) {
      if (!interest.id) {
        continue;
      }

      // Only match if the message was created after the interest was created
      // Both message.createdAt and interest.createdAt are ISO strings
      if (message.createdAt < interest.createdAt) {
        continue;
      }

      const { matches: isMatch, distance } = matchMessageToInterest(
        message,
        interest,
      );

      if (isMatch && distance !== null) {
        matches.push({
          messageId: message.id,
          userId: interest.userId,
          interestId: interest.id,
          distance,
        });
        logger.info("Match found", {
          messageId: message.id.substring(0, 8),
          userId: interest.userId.substring(0, 8),
          interestId: interest.id.substring(0, 8),
          distanceMeters: Math.round(distance),
        });
      }
    }
  }

  logger.info("Total matches found", { count: matches.length });

  return matches;
}

/**
 * Deduplicate matches - one notification per user per message
 */
export function deduplicateMatches(matches: MatchResult[]): MatchResult[] {
  logger.info("Deduplicating matches");

  const dedupedMap = new Map<string, MatchResult>();

  for (const match of matches) {
    const key = `${match.userId}-${match.messageId}`;
    const existing = dedupedMap.get(key);

    // Keep the match with the smallest distance
    if (!existing || match.distance < existing.distance) {
      dedupedMap.set(key, match);
    }
  }

  const deduped = Array.from(dedupedMap.values());
  logger.info("Deduplication complete", {
    remaining: deduped.length,
    removed: matches.length - deduped.length,
  });

  return deduped;
}

/**
 * Store notification matches in Firestore
 */
export async function storeNotificationMatches(
  db: OboDb,
  matches: MatchResult[],
): Promise<void> {
  logger.info("Storing notification matches");

  const now = new Date();

  for (const match of matches) {
    await db.notificationMatches.insertOne({
      userId: match.userId,
      messageId: match.messageId,
      interestId: match.interestId,
      distance: match.distance,
      matchedAt: now,
      notified: false,
    });
  }

  logger.info("Stored notification matches", { count: matches.length });
}

/**
 * Get unnotified matches
 */
export async function getUnnotifiedMatches(
  db: OboDb,
): Promise<NotificationMatch[]> {
  logger.info("Fetching unnotified matches");

  const docs = await db.notificationMatches.findUnnotified();

  const matches: NotificationMatch[] = docs.map((data) => {
    const toStr = (v: unknown): string =>
      v instanceof Date ? v.toISOString() : typeof v === "string" ? v : new Date().toISOString();

    return {
      id: data._id as string,
      userId: data.userId as string,
      messageId: data.messageId as string,
      interestId: data.interestId as string,
      matchedAt: toStr(data.matchedAt),
      notified: (data.notified as boolean) || false,
      notifiedAt: data.notifiedAt ? toStr(data.notifiedAt) : undefined,
      distance: data.distance as number | undefined,
    };
  });

  logger.info("Found unnotified matches", { count: matches.length });

  return matches;
}
