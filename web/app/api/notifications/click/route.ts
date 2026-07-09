import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuthToken } from "@/lib/verifyAuthToken";

export const runtime = "nodejs";

/**
 * POST /api/notifications/click
 *
 * Records the first click on a push notification.
 * Idempotent: first-write-wins for clickedAt.
 *
 * Auth paths:
 * - Authenticated (Bearer token): verifies the notification belongs to the user
 *   before writing clickedAt.
 * - Unauthenticated (SW fallback): records the click for aggregate counts only,
 *   without userId attribution check. Accepts { matchId } in body.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchId } = body;

    if (!matchId || typeof matchId !== "string") {
      return NextResponse.json(
        { error: "matchId is required" },
        { status: 400 },
      );
    }

    const db = await getDb();

    const authHeader = request.headers.get("authorization");

    if (authHeader) {
      // Authenticated path: verify the notification belongs to the user
      const { userId } = await verifyAuthToken(authHeader);

      const notification = await db.notificationMatches.findById(matchId);
      if (!notification || notification.userId !== userId) {
        return NextResponse.json(
          { error: "Notification not found" },
          { status: 404 },
        );
      }

      // First-write-wins: only set clickedAt if not already set
      if (!notification.clickedAt) {
        await db.notificationMatches.updateOne(matchId, {
          clickedAt: new Date().toISOString(),
        });
      }
    } else {
      // Unauthenticated SW fallback: record click for aggregate counts
      // No ownership check — just write if not already set
      const notification = await db.notificationMatches.findById(matchId);
      if (notification && !notification.clickedAt) {
        await db.notificationMatches.updateOne(matchId, {
          clickedAt: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
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

    console.error("Error recording notification click:", error);
    return NextResponse.json(
      { error: "Failed to record notification click" },
      { status: 500 },
    );
  }
}
