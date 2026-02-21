import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuthToken } from "@/lib/verifyAuthToken";

// GET - Fetch unread notification count for the user
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const db = await getDb();
    
    // Use DB-side count queries to avoid fetching unnecessary data
    // Firestore does not match documents with missing fields on "== null",
    // so instead:
    //  - count all notified notifications for the user
    //  - count all read notifications where readAt is not null
    //  - derive unreadCount by subtraction
    
    // Execute queries in parallel for better performance
    const [totalNotifiedCount, readCount] = await Promise.all([
      db.notificationMatches.count([
        { field: "userId", op: "==", value: userId },
        { field: "notified", op: "==", value: true },
      ]),
      db.notificationMatches.count([
        { field: "userId", op: "==", value: userId },
        { field: "notified", op: "==", value: true },
        { field: "readAt", op: "!=", value: null },
      ]),
    ]);

    const unreadCount = Math.max(0, totalNotifiedCount - readCount);

    return NextResponse.json({ count: unreadCount });
  } catch (error) {
    console.error("Error fetching unread notification count:", error);

    if (
      error instanceof Error &&
      (error.message === "Missing auth token" ||
        error.message === "Invalid auth token")
    ) {
      return NextResponse.json(
        { error: `Unauthorized - ${error.message}` },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch unread notification count" },
      { status: 500 },
    );
  }
}
