import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type {
  InternalMessage,
  IngestError,
} from "@/lib/types";
import type { WhereClause } from "@oboapp/db";

const PAGE_SIZE = 12;
const QUERY_BATCH_SIZE = 50;
const MAX_QUERY_BATCHES = 5;

function toISOString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function toOptionalISOString(value: unknown): string | undefined {
  if (!value) return undefined;
  return toISOString(value);
}

function recordToInternalMessage(record: Record<string, unknown>): InternalMessage {
  return {
    id: record._id as string,
    text: record.text as string,
    locality: (record.locality as string) ?? "",
    plainText: record.plainText as string | undefined,
    markdownText: record.markdownText as string | undefined,
    addresses: (record.addresses as InternalMessage["addresses"]) ?? [],
    geoJson: record.geoJson as InternalMessage["geoJson"],
    crawledAt: toOptionalISOString(record.crawledAt),
    createdAt: toISOString(record.createdAt),
    finalizedAt: toOptionalISOString(record.finalizedAt),
    source: record.source as string | undefined,
    sourceUrl: record.sourceUrl as string | undefined,
    categories: Array.isArray(record.categories) ? record.categories : [],
    timespanStart: toOptionalISOString(record.timespanStart),
    timespanEnd: toOptionalISOString(record.timespanEnd),
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

    const db = await getDb();

    const messages: InternalMessage[] = [];
    let batchCount = 0;
    let hasMore = false;
    let currentCursorDate: Date | null = null;

    if (cursorFinalizedAt) {
      const parsedDate = new Date(cursorFinalizedAt);
      if (Number.isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid cursorFinalizedAt parameter" },
          { status: 400 },
        );
      }
      currentCursorDate = parsedDate;
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

    let lastDoc: Record<string, unknown> | undefined;

    while (messages.length < PAGE_SIZE && batchCount < MAX_QUERY_BATCHES) {
      const whereClause: WhereClause[] = [
        { field: "finalizedAt", op: ">", value: new Date(0) },
      ];

      // For cursor pagination, filter out already-seen documents
      if (currentCursorDate) {
        whereClause.push({
          field: "finalizedAt", op: "<=", value: currentCursorDate,
        });
      }

      const docs = await db.messages.findMany({
        where: whereClause,
        orderBy: [{ field: "finalizedAt", direction: "desc" }],
        limit: QUERY_BATCH_SIZE,
      });

      batchCount += 1;

      if (docs.length === 0) {
        hasMore = false;
        break;
      }

      for (const doc of docs) {
        const hasGeoJsonField = Object.prototype.hasOwnProperty.call(
          doc,
          "geoJson",
        );
        if (!hasGeoJsonField || isGeoJsonMissing(doc.geoJson)) {
          messages.push(recordToInternalMessage(doc));
        }
      }

      lastDoc = docs.at(-1);
      hasMore = docs.length === QUERY_BATCH_SIZE;

      if (!hasMore || messages.length >= PAGE_SIZE) {
        break;
      }

      if (!lastDoc) {
        hasMore = false;
        break;
      }

      // Advance cursor to the finalizedAt of the last document in this batch
      const lastFinalizedAt = lastDoc.finalizedAt;
      currentCursorDate = lastFinalizedAt instanceof Date
        ? lastFinalizedAt
        : new Date(lastFinalizedAt as string);
    }

    const nextCursor =
      lastDoc && hasMore
        ? {
            finalizedAt: toISOString(lastDoc.finalizedAt),
            id: lastDoc._id as string,
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
