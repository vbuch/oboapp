import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { NotificationHistoryItem, DeviceNotification } from "@/lib/types";
import { verifyAuthToken } from "@/lib/verifyAuthToken";
import { convertTimestamp } from "@/lib/firestore-utils";

// GET - Fetch latest 20 notification history items for the user
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const matchesRef = adminDb.collection("notificationMatches");
    const snapshot = await matchesRef
      .where("userId", "==", userId)
      .where("notified", "==", true)
      .orderBy("notifiedAt", "desc")
      .limit(20)
      .get();

    const historyItems: NotificationHistoryItem[] = snapshot.docs.map((doc) => {
      const data = doc.data();

      // Calculate successful devices count
      const deviceNotifications = data.deviceNotifications || [];
      const successfulDevicesCount = deviceNotifications.filter(
        (d: DeviceNotification) => d.success
      ).length;

      return {
        id: doc.id,
        messageId: data.messageId,
        messageSnapshot: data.messageSnapshot || {
          text: "",
          createdAt: convertTimestamp(data.notifiedAt),
        },
        notifiedAt: convertTimestamp(data.notifiedAt),
        distance: data.distance,
        interestId: data.interestId,
        successfulDevicesCount,
      };
    });

    return NextResponse.json(historyItems);
  } catch (error) {
    console.error("Error fetching notification history:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification history" },
      { status: 500 }
    );
  }
}
