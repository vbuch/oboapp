import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuthToken } from "@/lib/verifyAuthToken";
import { UserPreferencesRequestSchema } from "@oboapp/shared";

/** GET — return current user's notification filter preferences */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const db = await getDb();
    const prefs = await db.userPreferences.findByUserId(userId);

    if (!prefs) {
      return NextResponse.json({
        notificationCategories: [],
        notificationSources: [],
      });
    }

    return NextResponse.json({
      notificationCategories: (prefs.notificationCategories as string[]) ?? [],
      notificationSources: (prefs.notificationSources as string[]) ?? [],
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Missing auth token") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching notification filters:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification filters" },
      { status: 500 },
    );
  }
}

/** PUT — save notification filter preferences */
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const body = await request.json();
    const parsed = UserPreferencesRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const db = await getDb();
    await db.userPreferences.upsertByUserId(userId, {
      notificationCategories: parsed.data.notificationCategories,
      notificationSources: parsed.data.notificationSources,
    });

    return NextResponse.json({
      notificationCategories: parsed.data.notificationCategories,
      notificationSources: parsed.data.notificationSources,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Missing auth token") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error saving notification filters:", error);
    return NextResponse.json(
      { error: "Failed to save notification filters" },
      { status: 500 },
    );
  }
}

/** DELETE — clear all notification filters (reset to no filtering) */
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const db = await getDb();
    const prefs = await db.userPreferences.findByUserId(userId);

    if (prefs) {
      const docId = prefs._id as string;
      await db.userPreferences.updateOne(docId, {
        notificationCategories: [],
        notificationSources: [],
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({
      notificationCategories: [],
      notificationSources: [],
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Missing auth token") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error clearing notification filters:", error);
    return NextResponse.json(
      { error: "Failed to clear notification filters" },
      { status: 500 },
    );
  }
}
