import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { verifyAuthToken } from "@/lib/verifyAuthToken";
import { ApiClientRequestSchema } from "@oboapp/shared";

function generateApiKey(): string {
  return `obo_${randomBytes(24).toString("base64url")}`;
}

/** GET — fetch the current user's API client (if any). */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const db = await getDb();
    const client = await db.apiClients.findByUserId(userId);

    if (!client) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      id: client._id,
      userId: client.userId,
      apiKey: client.apiKey,
      websiteUrl: client.websiteUrl,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching API client:", error);
    return NextResponse.json(
      { error: "Failed to fetch API client" },
      { status: 500 },
    );
  }
}

/** POST — register a new API client for the current user and generate a key. */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const body = await request.json();
    const parsed = ApiClientRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const db = await getDb();

    // One API key per user — reject if they already have one
    const existing = await db.apiClients.findByUserId(userId);
    if (existing) {
      return NextResponse.json(
        { error: "You already have an API key. Revoke it first to generate a new one." },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const apiKey = generateApiKey();

    const id = await db.apiClients.insertOne({
      userId,
      apiKey,
      websiteUrl: parsed.data.websiteUrl,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      {
        id,
        userId,
        apiKey,
        websiteUrl: parsed.data.websiteUrl,
        createdAt: now,
        updatedAt: now,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating API client:", error);
    return NextResponse.json(
      { error: "Failed to create API client" },
      { status: 500 },
    );
  }
}

/** DELETE — revoke (permanently delete) the current user's API client. */
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const db = await getDb();
    const client = await db.apiClients.findByUserId(userId);

    if (!client) {
      return NextResponse.json(
        { error: "No API client found" },
        { status: 404 },
      );
    }

    await db.apiClients.deleteOne(client._id as string);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking API client:", error);
    return NextResponse.json(
      { error: "Failed to revoke API client" },
      { status: 500 },
    );
  }
}
