import type { InterestCoverageReport, InterestRevision } from "@oboapp/shared";
import { aggregateInterestCoverage } from "./aggregate";

interface ReportDependencies {
  readRevision: () => Promise<InterestRevision>;
  readInterests: () => Promise<Record<string, unknown>[]>;
  save: (report: InterestCoverageReport) => Promise<void>;
}

/** Never publish a snapshot computed across a concurrent mutation. */
export async function generateInterestReport(deps: ReportDependencies, locality: string, dryRun = false) {
  const before = await deps.readRevision();
  if (before.pending !== 0) throw new Error("Interest mutation in progress; retry report generation later");
  const records = await deps.readInterests();
  const report = aggregateInterestCoverage(records, locality, before.revision);
  const after = await deps.readRevision();
  if (after.pending !== 0 || after.revision !== before.revision) {
    throw new Error("Interests changed during report generation; retry later");
  }
  if (!dryRun) await deps.save(report);
  // A mutation after the check leaves sourceRevision stale; serving rejects it.
  return report;
}
