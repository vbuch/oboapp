import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type {
  InternalMessage,
  IngestError,
} from "@/lib/types";
import type { WhereClause } from "@oboapp/db";
import {
  toOptionalISOString,
  toRequiredISOString,
} from "@/lib/date-serialization";

const PAGE_SIZE = 12;

function recordToInternalMessage(record: Record<string, unknown>): InternalMessage {
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
    cadastralProperties: Array.isArray(record.cadastralProperties) ? record.cadastralProperties : undefined,
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
        if (!features) return true;
      }
      return false;
    };

    const whereClause: WhereClause[] = [
      { field: "finalizedAt", op: ">", value: new Date(0) },
    ];

    if (currentCursorDate) {
      whereClause.push({
        field: "finalizedAt", op: "<=", value: currentCursorDate,
      });
    }

    const fetchedDocs = await db.messages.findMany({
      where: whereClause,
      orderBy: [{ field: "finalizedAt", direction: "desc" }],
    });

    const sortedDocs = [...fetchedDocs].sort((left, right) => {
      const leftDate = new Date(left.finalizedAt as string | Date).getTime();
      const rightDate = new Date(right.finalizedAt as string | Date).getTime();
      if (leftDate !== rightDate) {
        return rightDate - leftDate;
      }
      return String(right._id).localeCompare(String(left._id));
    });

    const cursorFilteredDocs =
      currentCursorDate && currentCursorId
        ? sortedDocs.filter((doc) => {
            const docFinalizedAt = new Date(doc.finalizedAt as string | Date).getTime();
            const cursorFinalizedAtTime = currentCursorDate.getTime();

            if (docFinalizedAt < cursorFinalizedAtTime) {
              return true;
            }

            if (docFinalizedAt > cursorFinalizedAtTime) {
              return false;
            }

            return String(doc._id).localeCompare(currentCursorId) < 0;
          })
        : sortedDocs;

    const ingestErrorDocs = cursorFilteredDocs.filter((doc) => {
      const hasGeoJsonField = Object.hasOwn(doc, "geoJson");
      return !hasGeoJsonField || isGeoJsonMissing(doc.geoJson);
    });

    const pageDocs = ingestErrorDocs.slice(0, PAGE_SIZE);
    const messages = pageDocs.map(recordToInternalMessage);
    const hasMore = ingestErrorDocs.length > PAGE_SIZE;
    const lastDoc = pageDocs.at(-1);

    const nextCursor =
      lastDoc && hasMore
        ? {
            finalizedAt: toRequiredISOString(lastDoc.finalizedAt, "finalizedAt"),
            id: String(lastDoc._id),
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
