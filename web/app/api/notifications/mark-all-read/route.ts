import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuthToken } from "@/lib/verifyAuthToken";

// POST - Mark all notifications as read for the user
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const db = await getDb();

    // Get all unread notifications for the user
    const unreadNotifications = await db.notificationMatches.findMany({
      where: [
        { field: "userId", op: "==", value: userId },
        { field: "notified", op: "==", value: true },
        { field: "readAt", op: "==", value: null },
      ],
    });

    // Mark each as read
    const readAt = new Date().toISOString();
    const updatePromises = unreadNotifications.map((notification) =>
      db.notificationMatches.updateOne(notification._id as string, { readAt }),
    );

    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      count: unreadNotifications.length,
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return NextResponse.json(
      { error: "Failed to mark all notifications as read" },
      { status: 500 },
    );
  }
}
