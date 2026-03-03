import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuthToken } from "@/lib/verifyAuthToken";
import type { UpgradeDecisionOption } from "@/lib/auth-upgrade";

type DbRecord = Record<string, unknown>;

interface UpgradeStats {
  guestInterests: number;
  accountInterests: number;
  guestSubscriptions: number;
  accountSubscriptions: number;
}

function parseGuestUserId(request: NextRequest): string | null {
  const { searchParams } = new URL(request.url);
  return searchParams.get("guestUserId");
}

function parseGuestProofToken(request: NextRequest): string | null {
  const token = request.headers.get("x-guest-token");
  return token && token.trim().length > 0 ? token : null;
}

async function getUpgradeStats(
  guestUserId: string,
  accountUserId: string,
): Promise<UpgradeStats> {
  const db = await getDb();

  const [
    guestInterests,
    accountInterests,
    guestSubscriptions,
    accountSubscriptions,
  ] = await Promise.all([
    db.interests.findByUserId(guestUserId),
    db.interests.findByUserId(accountUserId),
    db.notificationSubscriptions.findByUserId(guestUserId),
    db.notificationSubscriptions.findByUserId(accountUserId),
  ]);

  return {
    guestInterests: guestInterests.length,
    accountInterests: accountInterests.length,
    guestSubscriptions: guestSubscriptions.length,
    accountSubscriptions: accountSubscriptions.length,
  };
}

function getInterestKey(record: Record<string, unknown>): string {
  const coordinates =
    (record.coordinates as { lat?: number; lng?: number }) || {};
  const lat = coordinates.lat ?? "";
  const lng = coordinates.lng ?? "";
  const radius = (record.radius as number | undefined) ?? "";
  const label = (record.label as string | undefined) ?? "";
  const color = (record.color as string | undefined) ?? "";
  return `${lat}:${lng}:${radius}:${label}:${color}`;
}

function isUpgradeOption(value: unknown): value is UpgradeDecisionOption {
  return value === "import" || value === "keepSeparate" || value === "replace";
}

async function restoreUserState(
  userId: string,
  interestRecords: DbRecord[],
  subscriptionRecords: DbRecord[],
): Promise<void> {
  const db = await getDb();

  await Promise.all([
    db.interests.deleteAllByUserId(userId),
    db.notificationSubscriptions.deleteAllByUserId(userId),
  ]);

  for (const interestRecord of interestRecords) {
    await db.interests.insertOne({
      userId,
      coordinates: interestRecord.coordinates,
      radius: interestRecord.radius,
      label: interestRecord.label,
      color: interestRecord.color,
      createdAt:
        interestRecord.createdAt instanceof Date
          ? interestRecord.createdAt
          : new Date(),
      updatedAt:
        interestRecord.updatedAt instanceof Date
          ? interestRecord.updatedAt
          : new Date(),
    });
  }

  for (const subscriptionRecord of subscriptionRecords) {
    const token = (subscriptionRecord.token as string) ?? "";
    if (!token) {
      continue;
    }

    await db.notificationSubscriptions.insertOne({
      userId,
      token,
      endpoint: subscriptionRecord.endpoint,
      deviceInfo: subscriptionRecord.deviceInfo ?? {},
      createdAt:
        subscriptionRecord.createdAt instanceof Date
          ? subscriptionRecord.createdAt
          : new Date(),
      updatedAt:
        subscriptionRecord.updatedAt instanceof Date
          ? subscriptionRecord.updatedAt
          : new Date(),
    });
  }
}

function isAuthTokenError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    (error.message === "Missing auth token" ||
      error.message === "Invalid auth token")
  );
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId: accountUserId } = await verifyAuthToken(authHeader);

    const guestUserId = parseGuestUserId(request);
    if (!guestUserId) {
      return NextResponse.json(
        { error: "guestUserId is required" },
        { status: 400 },
      );
    }

    if (guestUserId === accountUserId) {
      return NextResponse.json({
        requiresDecision: false,
        hasGuestData: false,
        hasAccountData: false,
      });
    }

    const stats = await getUpgradeStats(guestUserId, accountUserId);

    const guestProofToken = parseGuestProofToken(request);
    if (!guestProofToken) {
      return NextResponse.json(
        { error: "Missing guest proof token" },
        { status: 401 },
      );
    }

    const { userId: proofGuestUserId } = await verifyAuthToken(
      `Bearer ${guestProofToken}`,
    );
    if (proofGuestUserId !== guestUserId) {
      return NextResponse.json(
        { error: "Guest proof token does not match guestUserId" },
        { status: 403 },
      );
    }
    const hasGuestData = stats.guestInterests + stats.guestSubscriptions > 0;
    const hasAccountData =
      stats.accountInterests + stats.accountSubscriptions > 0;

    return NextResponse.json({
      requiresDecision: hasGuestData && hasAccountData,
      hasGuestData,
      hasAccountData,
      stats,
    });
  } catch (error) {
    if (isAuthTokenError(error)) {
      const message = error.message;
      return NextResponse.json(
        { error: `Unauthorized - ${message}` },
        { status: 401 },
      );
    }

    console.error("Error checking upgrade conflict:", error);
    return NextResponse.json(
      { error: "Failed to check upgrade conflict" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId: accountUserId } = await verifyAuthToken(authHeader);

    const body = (await request.json()) as {
      guestUserId?: string;
      option?: UpgradeDecisionOption;
    };

    const guestUserId = body.guestUserId;
    const option = body.option;

    if (!guestUserId) {
      return NextResponse.json(
        { error: "guestUserId is required" },
        { status: 400 },
      );
    }

    if (!isUpgradeOption(option)) {
      return NextResponse.json({ error: "Invalid option" }, { status: 400 });
    }

    if (guestUserId === accountUserId) {
      return NextResponse.json({ success: true, option, changed: false });
    }

    const guestProofToken = parseGuestProofToken(request);
    if (!guestProofToken) {
      return NextResponse.json(
        { error: "Missing guest proof token" },
        { status: 401 },
      );
    }

    const { userId: proofGuestUserId } = await verifyAuthToken(
      `Bearer ${guestProofToken}`,
    );
    if (proofGuestUserId !== guestUserId) {
      return NextResponse.json(
        { error: "Guest proof token does not match guestUserId" },
        { status: 403 },
      );
    }

    if (option === "keepSeparate") {
      return NextResponse.json({ success: true, option, changed: false });
    }

    const db = await getDb();

    const [
      guestInterests,
      accountInterests,
      guestSubscriptions,
      accountSubscriptions,
    ] = await Promise.all([
      db.interests.findByUserId(guestUserId),
      db.interests.findByUserId(accountUserId),
      db.notificationSubscriptions.findByUserId(guestUserId),
      db.notificationSubscriptions.findByUserId(accountUserId),
    ]);

    try {
      if (option === "replace") {
        await Promise.all([
          db.interests.deleteAllByUserId(accountUserId),
          db.notificationSubscriptions.deleteAllByUserId(accountUserId),
        ]);

        for (const guestInterest of guestInterests) {
          await db.interests.insertOne({
            userId: accountUserId,
            coordinates: guestInterest.coordinates,
            radius: guestInterest.radius,
            label: guestInterest.label,
            color: guestInterest.color,
            createdAt:
              guestInterest.createdAt instanceof Date
                ? guestInterest.createdAt
                : new Date(),
            updatedAt: new Date(),
          });
        }

        for (const guestSubscription of guestSubscriptions) {
          const token = (guestSubscription.token as string) ?? "";
          if (!token) {
            continue;
          }

          await db.notificationSubscriptions.insertOne({
            userId: accountUserId,
            token,
            endpoint: guestSubscription.endpoint,
            deviceInfo: guestSubscription.deviceInfo ?? {},
            createdAt:
              guestSubscription.createdAt instanceof Date
                ? guestSubscription.createdAt
                : new Date(),
            updatedAt: new Date(),
          });
        }
      } else {
        const accountInterestKeys = new Set(
          accountInterests.map(getInterestKey),
        );
        const accountSubscriptionTokens = new Set(
          accountSubscriptions.map((doc) => (doc.token as string) ?? ""),
        );

        for (const guestInterest of guestInterests) {
          const key = getInterestKey(guestInterest);
          if (accountInterestKeys.has(key)) {
            continue;
          }

          await db.interests.insertOne({
            userId: accountUserId,
            coordinates: guestInterest.coordinates,
            radius: guestInterest.radius,
            label: guestInterest.label,
            color: guestInterest.color,
            createdAt:
              guestInterest.createdAt instanceof Date
                ? guestInterest.createdAt
                : new Date(),
            updatedAt: new Date(),
          });

          accountInterestKeys.add(key);
        }

        for (const guestSubscription of guestSubscriptions) {
          const token = (guestSubscription.token as string) ?? "";
          if (!token || accountSubscriptionTokens.has(token)) {
            continue;
          }

          await db.notificationSubscriptions.insertOne({
            userId: accountUserId,
            token,
            endpoint: guestSubscription.endpoint,
            deviceInfo: guestSubscription.deviceInfo ?? {},
            createdAt:
              guestSubscription.createdAt instanceof Date
                ? guestSubscription.createdAt
                : new Date(),
            updatedAt: new Date(),
          });

          accountSubscriptionTokens.add(token);
        }
      }

      await Promise.all([
        db.interests.deleteAllByUserId(guestUserId),
        db.notificationSubscriptions.deleteAllByUserId(guestUserId),
      ]);
    } catch (operationError) {
      console.error("Upgrade operation failed, restoring previous state", {
        operationError,
      });

      await Promise.all([
        restoreUserState(accountUserId, accountInterests, accountSubscriptions),
        restoreUserState(guestUserId, guestInterests, guestSubscriptions),
      ]);

      throw operationError;
    }

    return NextResponse.json({ success: true, option, changed: true });
  } catch (error) {
    if (isAuthTokenError(error)) {
      const message = error.message;
      return NextResponse.json(
        { error: `Unauthorized - ${message}` },
        { status: 401 },
      );
    }

    console.error("Error applying upgrade option:", error);
    return NextResponse.json(
      { error: "Failed to apply upgrade option" },
      { status: 500 },
    );
  }
}
