import {
  INTEREST_REPORT_PATH,
  INTEREST_REVISION_PATH,
  InterestCoverageReportSchema,
  InterestRevisionSchema,
} from "@oboapp/shared";
import type { InterestCoverageReport } from "@oboapp/shared";

let storage: import("@google-cloud/storage").Storage | undefined;

async function getBucket() {
  const name = process.env.GCS_GENERIC_BUCKET?.trim();
  if (!name) throw new Error("GCS_GENERIC_BUCKET must be configured to publish interest coverage");
  if (!storage) {
    const { Storage } = await import("@google-cloud/storage");
    storage = new Storage();
  }
  return storage.bucket(name);
}

export async function loadInterestRevision() {
  const bucket = await getBucket();
  try {
    const [content] = await bucket.file(INTEREST_REVISION_PATH).download();
    return InterestRevisionSchema.parse(JSON.parse(content.toString("utf-8")));
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 404) {
      return { revision: "initial", pending: 0 };
    }
    throw error;
  }
}

export async function saveInterestReport(report: InterestCoverageReport) {
  const bucket = await getBucket();
  await bucket.file(INTEREST_REPORT_PATH).save(JSON.stringify(InterestCoverageReportSchema.parse(report)), {
    contentType: "application/json", resumable: false,
  });
}
