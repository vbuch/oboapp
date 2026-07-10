/**
 * GCS persistence for the notifications report snapshot.
 *
 * Production: saves/loads `notifications/report.json` from GCS_GENERIC_BUCKET.
 * Offline / missing bucket: no-op read (returns null) and console warning on write.
 */

export interface NotificationsReportHeatmap {
  points: [number, number][];
  hiddenForPrivacy: boolean;
}

export interface NotificationsReportSource {
  source: string;
  sent: number;
  clicked: number;
}

export interface NotificationsReportSnapshot {
  generatedAt: string;
  /** ISO timestamp of the earliest clickedAt across all matches, or null if no clicks recorded yet. */
  trackedSince: string | null;
  kpis: {
    sent: number;
    uniqueUsers: number;
    clicked: number;
    opened: number;
  };
  sources: NotificationsReportSource[];
  heatmap: {
    all: NotificationsReportHeatmap;
    clicked: NotificationsReportHeatmap;
    opened: NotificationsReportHeatmap;
  };
}

const SNAPSHOT_PATH = "notifications/report.json";

let storage: import("@google-cloud/storage").Storage | null = null;

async function getStorage() {
  if (!storage) {
    const { Storage } = await import("@google-cloud/storage");
    storage = new Storage();
  }
  return storage;
}

export async function saveNotificationsReportSnapshot(
  snapshot: NotificationsReportSnapshot,
): Promise<void> {
  const bucket = process.env.GCS_GENERIC_BUCKET;
  if (!bucket) {
    console.warn(
      "GCS_GENERIC_BUCKET not set — skipping notifications report snapshot save",
    );
    return;
  }
  const gcs = await getStorage();
  const file = gcs.bucket(bucket).file(SNAPSHOT_PATH);
  await file.save(JSON.stringify(snapshot, null, 2), {
    contentType: "application/json",
  });
}

export async function loadNotificationsReportSnapshot(): Promise<NotificationsReportSnapshot | null> {
  const bucket = process.env.GCS_GENERIC_BUCKET;
  if (!bucket) return null;
  const gcs = await getStorage();
  const file = gcs.bucket(bucket).file(SNAPSHOT_PATH);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [content] = await file.download();
  const data: NotificationsReportSnapshot = JSON.parse(
    content.toString("utf-8"),
  );
  return data;
}
