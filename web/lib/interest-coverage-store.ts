import { randomUUID } from "node:crypto";
import {
  INTEREST_REPORT_PATH,
  INTEREST_REVISION_PATH,
  InterestCoverageReportSchema,
  InterestRevisionSchema,
} from "@oboapp/shared";
import type { InterestRevision } from "@oboapp/shared";

let storage: import("@google-cloud/storage").Storage | undefined;

async function getBucket() {
  const name = process.env.GCS_GENERIC_BUCKET?.trim();
  if (!name) throw new Error("Report bucket not configured");
  if (!storage) {
    const { Storage } = await import("@google-cloud/storage");
    storage = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? new Storage({ credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) })
      : new Storage();
  }
  return storage.bucket(name);
}

function hasCode(error: unknown, code: number) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

async function readRevision() {
  const bucket = await getBucket();
  let generation: string | number | undefined;
  try {
    const [metadata] = await bucket.file(INTEREST_REVISION_PATH).getMetadata();
    generation = metadata.generation;
  } catch (error) {
    if (!hasCode(error, 404)) throw error;
    return { state: { revision: "initial", pending: 0 }, generation: 0 };
  }
  if (!generation) throw new Error("Missing revision generation");
  // An overwritten pinned generation must fail closed, never look like a
  // missing marker: its pending count could now be larger than the one we saw.
  const [content] = await bucket.file(INTEREST_REVISION_PATH, { generation }).download();
  return { state: InterestRevisionSchema.parse(JSON.parse(content.toString("utf-8"))), generation };
}

async function changePending(delta: number) {
  const bucket = await getBucket();
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const current = await readRevision();
      const state: InterestRevision = {
        revision: randomUUID(),
        pending: current.state.pending + delta,
      };
      InterestRevisionSchema.parse(state);
      await bucket.file(INTEREST_REVISION_PATH).save(JSON.stringify(state), {
        contentType: "application/json",
        resumable: false,
        preconditionOpts: { ifGenerationMatch: current.generation },
      });
      return;
    } catch (error) {
      // Overwrites can invalidate the pinned download as well as the CAS save.
      if (!hasCode(error, 412) && !hasCode(error, 404)) throw error;
    }
  }
  throw new Error("Interest report revision contention");
}

/** Invalidate before any DB write. Fail closed if invalidation cannot be saved. */
export async function withInterestReportMutation<T>(mutation: () => Promise<T>): Promise<T> {
  if (!process.env.GCS_GENERIC_BUCKET?.trim()) return mutation();
  await changePending(1);
  try {
    return await mutation();
  } finally {
    // If this fails, pending remains nonzero and the report stays unavailable.
    await changePending(-1);
  }
}

/** GCS-only serving: no database reads or spatial aggregation in web requests. */
export async function loadCurrentInterestReport() {
  const before = await readRevision();
  if (before.state.pending !== 0) return null;
  const bucket = await getBucket();
  let raw: unknown;
  try {
    const [content] = await bucket.file(INTEREST_REPORT_PATH).download();
    raw = JSON.parse(content.toString("utf-8"));
  } catch (error) {
    if (hasCode(error, 404)) return null;
    throw error;
  }
  const report = InterestCoverageReportSchema.parse(raw);
  const age = Date.now() - new Date(report.generatedAt).getTime();
  if (age < 0 || age > 45 * 24 * 60 * 60 * 1000) return null;
  const after = await readRevision();
  if (after.generation !== before.generation || after.state.pending !== 0 ||
      report.sourceRevision !== after.state.revision) return null;
  return report;
}
