import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuthToken } from "@/lib/verifyAuthToken";

// GET - Fetch notification count for the user
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const db = await getDb();
    const count = await db.notificationMatches.count([
      { field: "userId", op: "==", value: userId },
      { field: "notified", op: "==", value: true },
    ]);

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Error fetching notification count:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification count" },
      { status: 500 },
    );
  }
}
