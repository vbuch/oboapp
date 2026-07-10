#!/usr/bin/env tsx
/**
 * Generate a notifications analytics report snapshot.
 *
 * Scans all notified notification matches, aggregates KPIs and per-source
 * breakdown, and pre-computes heatmap points for all three display modes
 * (all / clicked / opened). The resulting JSON is saved to GCS for the
 * web report page to load instead of querying the database on every request.
 *
 * Usage:
 *   pnpm tsx ingest/scripts/notifications-report.ts
 *   pnpm tsx ingest/scripts/notifications-report.ts --dry-run  # print stats, skip GCS write
 */

import { Command } from "commander";
import dotenv from "dotenv";
import { resolve } from "node:path";
import type { NotificationsReportSnapshot } from "@/lib/notifications/report-store";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

type HeatmapPoint = [number, number]; // [lat, lng]

const HEATMAP_PRIVACY_THRESHOLD = 50;

function extractHeatmapPoints(message: Record<string, unknown>): HeatmapPoint[] {
  if (message.cityWide) return [];

  const rawGeoJson = message.geoJson;
  if (
    !rawGeoJson ||
    typeof rawGeoJson !== "object" ||
    !("features" in rawGeoJson) ||
    !Array.isArray((rawGeoJson as Record<string, unknown>).features)
  ) {
    return [];
  }

  const points: HeatmapPoint[] = [];
  const features = (rawGeoJson as { features: unknown[] }).features;

  for (const feature of features) {
    if (!feature || typeof feature !== "object") continue;
    const geom = (feature as Record<string, unknown>).geometry;
    if (!geom || typeof geom !== "object") continue;

    const { type, coordinates } = geom as { type?: unknown; coordinates?: unknown };
    if (!Array.isArray(coordinates)) continue;

    if (type === "Point") {
      const [lng, lat] = coordinates as number[];
      if (typeof lat === "number" && typeof lng === "number") {
        points.push([lat, lng]);
      }
    } else if (type === "MultiPoint" || type === "LineString") {
      for (const coord of coordinates as unknown[][]) {
        const [lng, lat] = coord as number[];
        if (typeof lat === "number" && typeof lng === "number") {
          points.push([lat, lng]);
        }
      }
    } else if (type === "Polygon") {
      for (const ring of coordinates as unknown[][][]) {
        for (const coord of ring) {
          const [lng, lat] = coord as number[];
          if (typeof lat === "number" && typeof lng === "number") {
            points.push([lat, lng]);
          }
        }
      }
    }
  }

  return points;
}

function buildHeatmapMode(
  matches: Record<string, unknown>[],
  messageMap: Map<string, HeatmapPoint[]>,
  filter: (m: Record<string, unknown>) => boolean,
): { points: HeatmapPoint[]; hiddenForPrivacy: boolean } {
  const filtered = matches.filter(filter);
  const matchCount = filtered.length;

  if (matchCount < HEATMAP_PRIVACY_THRESHOLD) {
    return { points: [], hiddenForPrivacy: true };
  }

  const points: HeatmapPoint[] = [];
  for (const match of filtered) {
    const msgId = typeof match.messageId === "string" ? match.messageId : "";
    const pts = msgId ? (messageMap.get(msgId) ?? []) : [];
    points.push(...pts);
  }

  return { points, hiddenForPrivacy: false };
}

const program = new Command();

program
  .name("notifications-report")
  .description("Generate a GCS notifications analytics snapshot")
  .option("--dry-run", "Print stats without writing to GCS")
  .addHelpText(
    "after",
    `
Examples:
  $ pnpm tsx ingest/scripts/notifications-report.ts
  $ pnpm tsx ingest/scripts/notifications-report.ts --dry-run
`,
  )
  .action(async (opts: { dryRun?: boolean }) => {
    try {
      const { getDb, closeDb } = await import("@/lib/db");
      const { saveNotificationsReportSnapshot } = await import(
        "@/lib/notifications/report-store"
      );

      const db = await getDb();

      try {
        console.log("Fetching notification matches...");
        const matches = await db.notificationMatches.findMany({
          where: [{ field: "notified", op: "==", value: true }],
          select: [
            "_id",
            "userId",
            "messageId",
            "clickedAt",
            "openedAt",
            "messageSnapshot",
          ],
        }) as Record<string, unknown>[];

        console.log(`Found ${matches.length} notified matches`);

        // Aggregate KPIs
        const userIds = new Set<string>();
        let clicked = 0;
        let opened = 0;
        const sourceMap = new Map<string, { sent: number; clicked: number }>();
        let earliestClickedAt: Date | null = null;

        for (const match of matches) {
          if (typeof match.userId === "string" && match.userId) {
            userIds.add(match.userId);
          }

          if (match.clickedAt) {
            clicked++;
            const clickDate = new Date(String(match.clickedAt));
            if (!Number.isNaN(clickDate.getTime())) {
              if (!earliestClickedAt || clickDate < earliestClickedAt) {
                earliestClickedAt = clickDate;
              }
            }
          }

          if (match.openedAt) opened++;

          const source =
            typeof match.messageSnapshot === "object" &&
            match.messageSnapshot !== null &&
            "source" in (match.messageSnapshot as object) &&
            typeof (match.messageSnapshot as Record<string, unknown>).source === "string"
              ? (match.messageSnapshot as Record<string, unknown>).source as string
              : "(unknown)";

          const existing = sourceMap.get(source) ?? { sent: 0, clicked: 0 };
          existing.sent++;
          if (match.clickedAt) existing.clicked++;
          sourceMap.set(source, existing);
        }

        const sources = Array.from(sourceMap.entries())
          .map(([source, counts]) => ({ source, ...counts }))
          .sort((a, b) => b.sent - a.sent);

        // Collect unique messageIds for heatmap
        const messageIds = matches
          .filter((m) => typeof m.messageId === "string" && m.messageId)
          .map((m) => m.messageId as string);
        const uniqueMessageIds = [...new Set(messageIds)];

        console.log(`Fetching ${uniqueMessageIds.length} unique messages for heatmap...`);

        // Chunk into groups of 10 for Firestore in-operator limit.
        // Run all chunks in parallel — same approach as the web API route.
        const CHUNK_SIZE = 10;
        const messageMap = new Map<string, HeatmapPoint[]>();

        if (uniqueMessageIds.length > 0) {
          const chunks: string[][] = [];
          for (let i = 0; i < uniqueMessageIds.length; i += CHUNK_SIZE) {
            chunks.push(uniqueMessageIds.slice(i, i + CHUNK_SIZE));
          }
          const chunkResults = await Promise.all(
            chunks.map((chunk) =>
              db.messages.findMany({
                where: [{ field: "_id", op: "in", value: chunk }],
                select: ["_id", "geoJson", "cityWide"],
              }) as Promise<Record<string, unknown>[]>,
            ),
          );
          for (const msgs of chunkResults) {
            for (const msg of msgs) {
              const id = typeof msg._id === "string" ? msg._id : "";
              if (id) {
                messageMap.set(id, extractHeatmapPoints(msg));
              }
            }
          }
        }

        const snapshot: NotificationsReportSnapshot = {
          generatedAt: new Date().toISOString(),
          trackedSince: earliestClickedAt?.toISOString() ?? null,
          kpis: {
            sent: matches.length,
            uniqueUsers: userIds.size,
            clicked,
            opened,
          },
          sources,
          heatmap: {
            all: buildHeatmapMode(matches, messageMap, () => true),
            clicked: buildHeatmapMode(matches, messageMap, (m) => Boolean(m.clickedAt)),
            opened: buildHeatmapMode(matches, messageMap, (m) => Boolean(m.openedAt)),
          },
        };

        console.log("Snapshot summary:");
        console.log(`  Sent: ${snapshot.kpis.sent}`);
        console.log(`  Unique users: ${snapshot.kpis.uniqueUsers}`);
        console.log(`  Clicked: ${snapshot.kpis.clicked}`);
        console.log(`  Opened: ${snapshot.kpis.opened}`);
        console.log(`  Tracked since: ${snapshot.trackedSince ?? "(none)"}`);
        console.log(`  Heatmap all: ${snapshot.heatmap.all.points.length} points (hidden: ${snapshot.heatmap.all.hiddenForPrivacy})`);
        console.log(`  Heatmap clicked: ${snapshot.heatmap.clicked.points.length} points (hidden: ${snapshot.heatmap.clicked.hiddenForPrivacy})`);
        console.log(`  Heatmap opened: ${snapshot.heatmap.opened.points.length} points (hidden: ${snapshot.heatmap.opened.hiddenForPrivacy})`);

        if (opts.dryRun) {
          console.log("Dry run — skipping GCS write");
        } else {
          await saveNotificationsReportSnapshot(snapshot);
          console.log("Notifications report snapshot saved to GCS");
        }
      } finally {
        await closeDb();
      }
    } catch (error) {
      console.error("Notifications report generation failed:", error);
      process.exit(1);
    }
  });

program.parse(process.argv);
