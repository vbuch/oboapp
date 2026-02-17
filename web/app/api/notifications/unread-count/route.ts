import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuthToken } from "@/lib/verifyAuthToken";

// GET - Fetch unread notification count for the user
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const db = await getDb();
    
    // Fetch all notified notifications and filter client-side
    // This handles both readAt: null and missing readAt field
    const docs = await db.notificationMatches.findByUserId(userId, {
      limit: 1000, // Reasonable limit for counting
    });
    
    const unreadCount = docs.filter((doc) => {
      // A notification is unread if readAt is null, undefined, or empty string
      const readAt = doc.readAt;
      return !readAt || readAt === null || readAt === "";
    }).length;

    return NextResponse.json({ count: unreadCount });
  } catch (error) {
    console.error("Error fetching unread notification count:", error);
    return NextResponse.json(
      { error: "Failed to fetch unread notification count" },
      { status: 500 },
    );
  }
}
