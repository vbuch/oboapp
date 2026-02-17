import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { NotificationHistoryItem, DeviceNotification } from "@/lib/types";
import { verifyAuthToken } from "@/lib/verifyAuthToken";
import {
  toOptionalISOString,
  toRequiredISOString,
} from "@/lib/date-serialization";

// GET - Fetch notification history items for the user with pagination
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    // Get pagination parameters from query string
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Number.parseInt(searchParams.get("limit") || "20", 10),
      100, // Max 100 items per request
    );
    const offset = Number.parseInt(searchParams.get("offset") || "0", 10);

    const db = await getDb();
    
    // Fetch one extra item to check if there are more
    const docs = await db.notificationMatches.findByUserId(userId, {
      limit: limit + 1,
      offset,
    });

    const hasMore = docs.length > limit;
    const itemsToReturn = hasMore ? docs.slice(0, limit) : docs;

    const historyItems: NotificationHistoryItem[] = itemsToReturn.map((doc) => {
      const notifiedAt = toRequiredISOString(doc.notifiedAt, "notifiedAt");
      const messageSnapshot =
        (doc.messageSnapshot as NotificationHistoryItem["messageSnapshot"]) ||
        undefined;

      // Calculate successful devices count
      const deviceNotifications =
        (doc.deviceNotifications as DeviceNotification[]) || [];
      const successfulDevicesCount = deviceNotifications.filter(
        (d: DeviceNotification) => d.success,
      ).length;

      return {
        id: doc._id as string,
        messageId: doc.messageId as string,
        messageSnapshot: {
          text: messageSnapshot?.text ?? "",
          createdAt:
            toOptionalISOString(
              messageSnapshot?.createdAt,
              "messageSnapshot.createdAt",
            ) ?? notifiedAt,
        },
        notifiedAt,
        distance: doc.distance as number,
        interestId: doc.interestId as string,
        successfulDevicesCount,
        readAt: toOptionalISOString(doc.readAt, "readAt"),
      };
    });

    return NextResponse.json({
      items: historyItems,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    });
  } catch (error) {
    console.error("Error fetching notification history:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification history" },
      { status: 500 },
    );
  }
}
