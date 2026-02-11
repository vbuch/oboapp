import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  InternalMessage,
  GeoJSONFeatureCollection,
  Address,
  IngestError,
} from "@/lib/types";
import { convertTimestamp, safeJsonParse } from "@/lib/firestore-utils";
import admin from "firebase-admin";

const PAGE_SIZE = 12;
const QUERY_BATCH_SIZE = 50;
const MAX_QUERY_BATCHES = 5;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cursorFinalizedAt = searchParams.get("cursorFinalizedAt");
    const cursorId = searchParams.get("cursorId");

    const earliestFinalizedAt = admin.firestore.Timestamp.fromDate(new Date(0));

    const messagesRef = adminDb.collection("messages");
    let query: FirebaseFirestore.Query = messagesRef
      .where("finalizedAt", ">", earliestFinalizedAt)
      .orderBy("finalizedAt", "desc")
      .orderBy(admin.firestore.FieldPath.documentId(), "desc")
      .limit(QUERY_BATCH_SIZE);

    if (cursorFinalizedAt && cursorId) {
      const cursorDate = new Date(cursorFinalizedAt);
      if (Number.isNaN(cursorDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid cursorFinalizedAt parameter" },
          { status: 400 },
        );
      }

      const cursorTimestamp = admin.firestore.Timestamp.fromDate(cursorDate);
      query = query.startAfter(cursorTimestamp, cursorId);
    }

    const messages: InternalMessage[] = [];
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    let batchCount = 0;
    let hasMore = false;

    const isGeoJsonMissing = (value: unknown): boolean => {
      if (value === null || value === undefined) {
        return true;
      }
      if (typeof value === "string") {
        return value.trim().length === 0;
      }
      return false;
    };

    while (messages.length < PAGE_SIZE && batchCount < MAX_QUERY_BATCHES) {
      const snapshot = await query.get();
      batchCount += 1;

      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      snapshot.forEach((doc) => {
        const data = doc.data();
        const hasGeoJsonField = Object.prototype.hasOwnProperty.call(
          data ?? {},
          "geoJson",
        );
        if (!hasGeoJsonField || isGeoJsonMissing(data.geoJson)) {
          messages.push({
            id: doc.id,
            text: data.text,
            locality: data.locality,
            plainText: data.plainText,
            markdownText: data.markdownText,
            addresses: data.addresses
              ? safeJsonParse<Address[]>(data.addresses, [], "addresses")
              : [],
            geoJson: data.geoJson
              ? safeJsonParse<GeoJSONFeatureCollection>(
                  data.geoJson,
                  undefined,
                  "geoJson",
                )
              : undefined,
            crawledAt: data.crawledAt
              ? convertTimestamp(data.crawledAt)
              : undefined,
            createdAt: convertTimestamp(data.createdAt),
            finalizedAt: data.finalizedAt
              ? convertTimestamp(data.finalizedAt)
              : undefined,
            source: data.source,
            sourceUrl: data.sourceUrl,
            categories: Array.isArray(data.categories) ? data.categories : [],
            timespanStart: data.timespanStart
              ? convertTimestamp(data.timespanStart)
              : undefined,
            timespanEnd: data.timespanEnd
              ? convertTimestamp(data.timespanEnd)
              : undefined,
            cityWide: data.cityWide || false,
            responsibleEntity: data.responsibleEntity,
            pins: Array.isArray(data.pins) ? data.pins : undefined,
            streets: Array.isArray(data.streets) ? data.streets : undefined,
            cadastralProperties: Array.isArray(data.cadastralProperties)
              ? data.cadastralProperties
              : undefined,
            busStops: Array.isArray(data.busStops) ? data.busStops : undefined,
            // Internal-only fields
            process: Array.isArray(data.process) ? data.process : undefined,
            ingestErrors: Array.isArray(data.ingestErrors)
              ? data.ingestErrors
              : typeof data.ingestErrors === "string"
                ? safeJsonParse<IngestError[]>(
                    data.ingestErrors,
                    undefined,
                    "ingestErrors",
                  )
                : undefined,
          });
        }
      });

      lastDoc = snapshot.docs.at(-1);
      hasMore = snapshot.size === QUERY_BATCH_SIZE;

      if (!hasMore || messages.length >= PAGE_SIZE) {
        break;
      }

      if (!lastDoc) {
        hasMore = false;
        break;
      }

      query = messagesRef
        .where("finalizedAt", ">", earliestFinalizedAt)
        .orderBy("finalizedAt", "desc")
        .orderBy(admin.firestore.FieldPath.documentId(), "desc")
        .startAfter(lastDoc.data().finalizedAt, lastDoc.id)
        .limit(QUERY_BATCH_SIZE);
    }

    const lastDocForCursor = lastDoc;
    const nextCursor =
      lastDocForCursor && hasMore
        ? {
            finalizedAt: convertTimestamp(lastDocForCursor.data().finalizedAt),
            id: lastDocForCursor.id,
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
