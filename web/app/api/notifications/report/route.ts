import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hasReportPagesEnabled } from "@/lib/report-pages";
import {
  aggregateNotificationKpis,
  buildHeatmapResult,
  extractHeatmapPointsFromMessage,
  getMessageIdsForMode,
  HEATMAP_PRIVACY_THRESHOLD,
  type HeatmapMode,
  type HeatmapPoint,
} from "./aggregation";

export const runtime = "nodejs";

const VALID_MODES: HeatmapMode[] = ["all", "clicked", "opened"];

// Firestore limits `in` queries to 10 values per clause
const FIRESTORE_IN_OPERATOR_LIMIT = 10;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * GET /api/notifications/report?mode=all|clicked|opened
 *
 * Returns all-time notification analytics:
 * - KPIs: sent, unique users, clicked, opened
 * - Heatmap points from triggering message coordinates, filtered by mode
 * - Source breakdown: sent + clicked counts per source
 *
 * Applies a privacy threshold: if the selected mode has fewer than 50 records,
 * heatmap points are withheld and heatmapHiddenForPrivacy=true is returned.
 *
 * Public route — no auth required. Gated by hasReportPagesEnabled().
 */
export async function GET(request: NextRequest) {
  if (!hasReportPagesEnabled()) {
    return NextResponse.json(
      { error: "Report pages not configured" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const rawMode = searchParams.get("mode") ?? "all";
  const mode: HeatmapMode = VALID_MODES.find((m) => m === rawMode) ?? "all";

  try {
    const db = await getDb();

    // Fetch all notified notification matches (select only fields needed)
    const allMatches = await db.notificationMatches.findMany({
      where: [{ field: "notified", op: "==", value: true }],
      select: [
        "_id",
        "userId",
        "messageId",
        "clickedAt",
        "openedAt",
        "messageSnapshot",
      ],
    });

    const kpis = aggregateNotificationKpis(allMatches);

    // Collect unique messageIds for the selected heatmap mode
    const messageIds = getMessageIdsForMode(allMatches, mode);
    const uniqueMessageIds = [...new Set(messageIds)];

    // Skip the message fetch entirely when the privacy threshold isn't met —
    // buildHeatmapResult would discard the points anyway, and the fetch can be
    // expensive for large datasets.
    const heatmapPoints: HeatmapPoint[] = [];
    if (messageIds.length >= HEATMAP_PRIVACY_THRESHOLD && uniqueMessageIds.length > 0) {
      // Fetch matching messages to extract coordinates (only geoJson + cityWide).
      // Chunk into groups of FIRESTORE_IN_OPERATOR_LIMIT to stay within Firestore's
      // `in` operator limit of 10 values.
      const idChunks = chunkArray(uniqueMessageIds, FIRESTORE_IN_OPERATOR_LIMIT);
      const messageChunks = await Promise.all(
        idChunks.map((chunk) =>
          db.messages.findMany({
            where: [{ field: "_id", op: "in", value: chunk }],
            select: ["_id", "geoJson", "cityWide"],
          }),
        ),
      );
      const messages = messageChunks.flat();

      // Build a map from messageId → coordinates
      const messageCoordMap = new Map<string, HeatmapPoint[]>();
      for (const msg of messages) {
        const id = typeof msg._id === "string" ? msg._id : "";
        if (id) {
          messageCoordMap.set(id, extractHeatmapPointsFromMessage(msg));
        }
      }

      // Each notification match contributes the points from its triggering message (1:1)
      for (const matchMessageId of messageIds) {
        const pts = messageCoordMap.get(matchMessageId);
        if (pts) {
          heatmapPoints.push(...pts);
        }
      }
    }

    const { points, heatmapHiddenForPrivacy } = buildHeatmapResult(
      messageIds.length,
      heatmapPoints,
    );

    return NextResponse.json(
      {
        sent: kpis.sent,
        uniqueUsers: kpis.uniqueUsers,
        clicked: kpis.clicked,
        opened: kpis.opened,
        heatmapPoints: points,
        heatmapHiddenForPrivacy,
        sources: kpis.sources,
      },
      {
        headers: {
          // Cache for 5 minutes — analytics data is not real-time
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      },
    );
  } catch (error) {
    console.error("Error generating notifications report:", error);
    return NextResponse.json(
      { error: "Failed to generate notifications report" },
      { status: 500 },
    );
  }
}
