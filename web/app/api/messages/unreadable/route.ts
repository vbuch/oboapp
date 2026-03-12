import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { WhereClause } from "@oboapp/db";
import { toRequiredISOString } from "@/lib/date-serialization";
import { recordToInternalMessage } from "../record-to-internal-message";
import { toTimestamp } from "../pagination-utils";

const PAGE_SIZE = 12;
// Fetch a large batch and apply in-memory isUnreadable filter, mirroring the
// ingest-errors pattern. A Firestore index optimisation is possible in the future
// by storing a sparse `unreadableAt` timestamp field (only set when true) and
// querying on that, since boolean equality indexes don't accelerate range scans.
const FETCH_LIMIT = 500;

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

        if (doc.isUnreadable !== true) {
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

    let boundaryDoc: Record<string, unknown> | undefined;

    if (hasMoreCandidates) {
      boundaryDoc = lastDoc;
    } else if (hitFetchLimit) {
      // When the DB batch was truncated at FETCH_LIMIT but not enough candidates
      // filled the page, use the lowest _id within the oldest-timestamp bucket
      // as the cursor. This ensures same-timestamp docs are never skipped on the
      // next page (picking an arbitrary _id from that bucket would lose others).
      const validDocs = fetchedDocs.filter(
        (doc) => toTimestamp(doc.finalizedAt) !== null,
      );

      if (validDocs.length > 0) {
        let oldestTime = toTimestamp(validDocs[0].finalizedAt)!;
        for (let i = 1; i < validDocs.length; i += 1) {
          const t = toTimestamp(validDocs[i].finalizedAt)!;
          if (t < oldestTime) {
            oldestTime = t;
          }
        }

        const oldestBucket = validDocs.filter(
          (doc) => toTimestamp(doc.finalizedAt) === oldestTime,
        );

        oldestBucket.sort((left, right) =>
          String(left._id).localeCompare(String(right._id)),
        );

        boundaryDoc = oldestBucket[0];
      }
    }

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
    console.error("Error fetching unreadable messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch unreadable messages" },
      { status: 500 },
    );
  }
}
