import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hasReportPagesEnabled } from "@/lib/report-pages";
import {
  aggregateNotificationKpis,
  buildHeatmapResult,
  extractHeatmapPointsFromMessage,
  getMessageIdsForMode,
  type HeatmapMode,
  type HeatmapPoint,
} from "./aggregation";

export const runtime = "nodejs";

const VALID_MODES: HeatmapMode[] = ["all", "clicked", "opened"];

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

    // Fetch matching messages to extract coordinates (only geoJson + cityWide)
    const heatmapPoints: HeatmapPoint[] = [];
    if (uniqueMessageIds.length > 0) {
      const messages = await db.messages.findMany({
        where: [{ field: "_id", op: "in", value: uniqueMessageIds }],
        select: ["_id", "geoJson", "cityWide"],
      });

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
