import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { WhereClause } from "@oboapp/db";
import { toRequiredISOString } from "@/lib/date-serialization";
import { recordToInternalMessage } from "../record-to-internal-message";
import { paginateCandidateDocs } from "../pagination-utils";

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

    const cursor = currentCursorDate
      ? { date: currentCursorDate, id: currentCursorId! }
      : null;

    const { pageDocs, boundaryDoc, hasMore } = paginateCandidateDocs(
      fetchedDocs,
      cursor,
      (doc) => doc.isUnreadable === true,
      PAGE_SIZE,
      FETCH_LIMIT,
    );

    const messages = pageDocs.map(recordToInternalMessage);
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
