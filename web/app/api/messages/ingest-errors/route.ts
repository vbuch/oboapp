import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { InternalMessage, IngestError } from "@/lib/types";
import type { WhereClause } from "@oboapp/db";
import {
  toOptionalISOString,
  toRequiredISOString,
} from "@/lib/date-serialization";

const PAGE_SIZE = 12;
const FETCH_LIMIT = 500;

function toTimestamp(value: unknown): number | null {
  const timestamp = new Date(value as string | Date).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function recordToInternalMessage(
  record: Record<string, unknown>,
): InternalMessage {
  return {
    id: record._id as string,
    text: record.text as string,
    locality: (record.locality as string) ?? "",
    plainText: record.plainText as string | undefined,
    markdownText: record.markdownText as string | undefined,
    addresses: (record.addresses as InternalMessage["addresses"]) ?? [],
    geoJson: record.geoJson as InternalMessage["geoJson"],
    crawledAt: toOptionalISOString(record.crawledAt, "crawledAt"),
    createdAt: toRequiredISOString(record.createdAt, "createdAt"),
    finalizedAt: toOptionalISOString(record.finalizedAt, "finalizedAt"),
    source: record.source as string | undefined,
    sourceUrl: record.sourceUrl as string | undefined,
    categories: Array.isArray(record.categories) ? record.categories : [],
    timespanStart: toOptionalISOString(record.timespanStart, "timespanStart"),
    timespanEnd: toOptionalISOString(record.timespanEnd, "timespanEnd"),
    cityWide: (record.cityWide as boolean) || false,
    responsibleEntity: record.responsibleEntity as string | undefined,
    pins: Array.isArray(record.pins) ? record.pins : undefined,
    streets: Array.isArray(record.streets) ? record.streets : undefined,
    cadastralProperties: Array.isArray(record.cadastralProperties)
      ? record.cadastralProperties
      : undefined,
    busStops: Array.isArray(record.busStops) ? record.busStops : undefined,
    // Internal-only fields
    process: Array.isArray(record.process) ? record.process : undefined,
    ingestErrors: Array.isArray(record.ingestErrors)
      ? (record.ingestErrors as IngestError[])
      : undefined,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cursorFinalizedAt = searchParams.get("cursorFinalizedAt");
    const cursorId = searchParams.get("cursorId");

    if ((cursorFinalizedAt && !cursorId) || (!cursorFinalizedAt && cursorId)) {
      return NextResponse.json(
        {
          error:
            "Both cursorFinalizedAt and cursorId must be provided together",
        },
        { status: 400 },
      );
    }

    const db = await getDb();
    let currentCursorDate: Date | null = null;
    let currentCursorId: string | null = null;

    if (cursorFinalizedAt) {
      const parsedDate = new Date(cursorFinalizedAt);
      if (Number.isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid cursorFinalizedAt parameter" },
          { status: 400 },
        );
      }
      currentCursorDate = parsedDate;
      currentCursorId = cursorId;
    }

    const isGeoJsonMissing = (value: unknown): boolean => {
      if (value === null || value === undefined) {
        return true;
      }
      if (typeof value === "string") {
        return value.trim().length === 0;
      }
      // Check for empty FeatureCollection (object with no features)
      if (typeof value === "object") {
        const fc = value as Record<string, unknown>;
        const features = fc.features;
        if (!Array.isArray(features) || features.length === 0) return true;
      }
      return false;
    };

    const whereClause: WhereClause[] = [
      { field: "finalizedAt", op: ">", value: new Date(0) },
    ];

    if (currentCursorDate) {
      whereClause.push({
        field: "finalizedAt",
        op: "<=",
        value: currentCursorDate,
      });
    }

    const fetchedDocs = await db.messages.findMany({
      where: whereClause,
      orderBy: [{ field: "finalizedAt", direction: "desc" }],
      limit: FETCH_LIMIT,
    });

    const shouldIncludeByCursor = (doc: Record<string, unknown>): boolean => {
      if (!currentCursorDate || !currentCursorId) {
        return true;
      }

      const docFinalizedAt = new Date(
        doc.finalizedAt as string | Date,
      ).getTime();
      const cursorFinalizedAtTime = currentCursorDate.getTime();

      if (docFinalizedAt < cursorFinalizedAtTime) {
        return true;
      }

      if (docFinalizedAt > cursorFinalizedAtTime) {
        return false;
      }

      return String(doc._id).localeCompare(currentCursorId) < 0;
    };

    const candidateDocs: Record<string, unknown>[] = [];
    const targetCount = PAGE_SIZE + 1;
    let index = 0;

    while (index < fetchedDocs.length && candidateDocs.length < targetCount) {
      const bucketStart = fetchedDocs[index];
      const bucketTime = toTimestamp(bucketStart.finalizedAt);
      if (bucketTime === null) {
        index += 1;
        continue;
      }
      const bucket: Record<string, unknown>[] = [];

      while (index < fetchedDocs.length) {
        const current = fetchedDocs[index];
        const currentTime = toTimestamp(current.finalizedAt);
        if (currentTime === null) {
          index += 1;
          continue;
        }
        if (currentTime !== bucketTime) {
          break;
        }
        bucket.push(current);
        index += 1;
      }

      bucket.sort((left, right) =>
        String(right._id).localeCompare(String(left._id)),
      );

      for (const doc of bucket) {
        if (!shouldIncludeByCursor(doc)) {
          continue;
        }

        const hasGeoJsonField = Object.hasOwn(doc, "geoJson");
        if (hasGeoJsonField && !isGeoJsonMissing(doc.geoJson)) {
          continue;
        }

        candidateDocs.push(doc);
        if (candidateDocs.length >= targetCount) {
          break;
        }
      }
    }

    const pageDocs = candidateDocs.slice(0, PAGE_SIZE);
    const messages = pageDocs.map(recordToInternalMessage);
    const hasMoreCandidates = candidateDocs.length > PAGE_SIZE;
    const hitFetchLimit = fetchedDocs.length === FETCH_LIMIT;
    const hasMore = hasMoreCandidates || hitFetchLimit;
    const lastDoc = pageDocs.at(-1);
    const boundaryDoc = hasMoreCandidates
      ? lastDoc
      : [...fetchedDocs]
          .reverse()
          .find((doc) => toTimestamp(doc.finalizedAt) !== null);

    const nextCursor =
      boundaryDoc && hasMore
        ? {
            finalizedAt: toRequiredISOString(
              boundaryDoc.finalizedAt,
              "finalizedAt",
            ),
            id: String(boundaryDoc._id),
          }
        : undefined;

    return NextResponse.json({ messages, nextCursor });
  } catch (error) {
    console.error("Error fetching ingest error messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch ingest error messages" },
      { status: 500 },
    );
  }
}
