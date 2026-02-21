import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuthToken } from "@/lib/verifyAuthToken";

// DELETE - Delete all user data and account
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const db = await getDb();

    // Delete all user data from multiple collections

    // 1. Count and delete all interests
    const interestsDeleted = await db.interests.deleteAllByUserId(userId);

    // 2. Count and delete all notification subscriptions
    const subscriptionsDeleted =
      await db.notificationSubscriptions.deleteAllByUserId(userId);

    // 3. Count and delete all notification matches
    const matchesDeleted =
      await db.notificationMatches.deleteAllByUserId(userId);

    // 4. Delete API client (if any)
    await db.apiClients.deleteByUserId(userId);

    // 5. Delete the Firebase Auth user
    // This requires recent re-authentication on the client side (which we enforce in the UI)
    try {
      const { adminAuth } = await import("@/lib/firebase-admin");
      await adminAuth.deleteUser(userId);
    } catch (authError) {
      console.error("Error deleting Firebase Auth user:", authError);
      // Continue even if auth deletion fails - database data is already deleted
    }

    return NextResponse.json({
      success: true,
      deleted: {
        interests: interestsDeleted,
        subscriptions: subscriptionsDeleted,
        matches: matchesDeleted,
      },
    });
  } catch (error) {
    console.error("Error deleting user data:", error);
    return NextResponse.json(
      { error: "Failed to delete user data" },
      { status: 500 },
    );
  }
}
