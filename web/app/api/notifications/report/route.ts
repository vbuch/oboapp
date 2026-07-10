import { NextRequest, NextResponse } from "next/server";
import { hasReportPagesEnabled } from "@/lib/report-pages";
import type { HeatmapMode } from "./aggregation";

export const runtime = "nodejs";

const VALID_MODES: HeatmapMode[] = ["all", "clicked", "opened"];

/**
 * GET /api/notifications/report?mode=all|clicked|opened
 *
 * Returns pre-generated notification analytics from a GCS snapshot.
 * The snapshot is produced weekly by the notifications-report ingest job.
 *
 * Response includes:
 * - KPIs: sent, unique users, clicked, opened
 * - Heatmap points for the selected mode (with privacy threshold applied)
 * - Source breakdown: sent + clicked counts per source
 * - generatedAt: when the snapshot was last computed
 * - trackedSince: ISO timestamp of the earliest click recorded (null if none yet)
 *
 * Returns 503 when GCS is not configured or the snapshot has not been generated yet.
 * Public route — no auth required. Gated by hasReportPagesEnabled().
 */
export async function GET(request: NextRequest) {
  if (!hasReportPagesEnabled()) {
    return NextResponse.json(
      { error: "Report pages not configured" },
      { status: 503 },
    );
  }

  const bucket = process.env.GCS_GENERIC_BUCKET;
  if (!bucket) {
    return NextResponse.json(
      { error: "GCS_GENERIC_BUCKET not configured" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const rawMode = searchParams.get("mode") ?? "all";
  const mode: HeatmapMode = VALID_MODES.find((m) => m === rawMode) ?? "all";

  try {
    let storage: import("@google-cloud/storage").Storage;
    const { Storage } = await import("@google-cloud/storage");
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      storage = new Storage({ credentials });
    } else {
      storage = new Storage();
    }

    const file = storage.bucket(bucket).file("notifications/report.json");
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json(
        { error: "Notifications report not generated yet" },
        { status: 503 },
      );
    }

    const [content] = await file.download();
    const snapshot = JSON.parse(content.toString("utf-8"));

    const heatmapForMode = snapshot.heatmap?.[mode] ?? {
      points: [],
      hiddenForPrivacy: true,
    };

    return NextResponse.json(
      {
        sent: snapshot.kpis?.sent ?? 0,
        uniqueUsers: snapshot.kpis?.uniqueUsers ?? 0,
        clicked: snapshot.kpis?.clicked ?? 0,
        opened: snapshot.kpis?.opened ?? 0,
        heatmapPoints: heatmapForMode.points ?? [],
        heatmapHiddenForPrivacy: heatmapForMode.hiddenForPrivacy ?? true,
        sources: snapshot.sources ?? [],
        generatedAt: snapshot.generatedAt ?? null,
        trackedSince: snapshot.trackedSince ?? null,
      },
      {
        headers: {
          // Cache until next weekly regeneration — data only changes when the job runs
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
        },
      },
    );
  } catch (error) {
    console.error("Error loading notifications report snapshot:", error);
    return NextResponse.json(
      { error: "Failed to load notifications report" },
      { status: 500 },
    );
  }
}

