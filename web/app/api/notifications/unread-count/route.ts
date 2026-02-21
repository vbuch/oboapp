import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuthToken } from "@/lib/verifyAuthToken";

// GET - Fetch unread notification count for the user
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const db = await getDb();
    
    // Use DB-side count query to avoid fetching unnecessary data
    // Count notifications where readAt is null (unread)
    const unreadCount = await db.notificationMatches.count([
      { field: "userId", op: "==", value: userId },
      { field: "notified", op: "==", value: true },
      { field: "readAt", op: "==", value: null },
    ]);

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
