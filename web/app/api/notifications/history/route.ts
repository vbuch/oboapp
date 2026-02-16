import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { NotificationHistoryItem, DeviceNotification } from "@/lib/types";
import { verifyAuthToken } from "@/lib/verifyAuthToken";
import {
  toOptionalISOString,
  toRequiredISOString,
} from "@/lib/date-serialization";

// GET - Fetch latest 20 notification history items for the user
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const db = await getDb();
    const docs = await db.notificationMatches.findByUserId(userId, {
      limit: 20,
    });

    const historyItems: NotificationHistoryItem[] = docs.map((doc) => {
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
      };
    });

    return NextResponse.json(historyItems);
  } catch (error) {
    console.error("Error fetching notification history:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification history" },
      { status: 500 },
    );
  }
}
