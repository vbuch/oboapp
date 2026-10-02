import {
  NotificationsReportSnapshotSchema,
  type NotificationsReportSnapshot,
} from "@oboapp/shared";

export async function saveNotificationsReportSnapshot(
  snapshot: NotificationsReportSnapshot,
): Promise<void> {
  const bucket = process.env.GCS_GENERIC_BUCKET?.trim();
  if (!bucket)
    throw new Error(
      "GCS_GENERIC_BUCKET is required to save the notifications report",
    );
  const { Storage } = await import("@google-cloud/storage");
  const storage = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? new Storage({
        credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY),
      })
    : new Storage();
  await storage
    .bucket(bucket)
    .file("notifications/report.json")
    .save(JSON.stringify(NotificationsReportSnapshotSchema.parse(snapshot)), {
      contentType: "application/json",
    });
}
