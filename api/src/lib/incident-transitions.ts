import type { SourceSnapshot } from "@oboapp/shared";
import type { SourceIncidentChangesResponse } from "../schema/response";

type Coverage = SourceIncidentChangesResponse["coverage"];
const GAP_THRESHOLD_MINUTES = 45;
const STALE_AFTER_MINUTES = 60;

function countTransitions(snapshots: SourceSnapshot[]) {
  let added = 0;
  let removed = 0;
  let previous = new Set<string>();
  for (const [index, snapshot] of snapshots.entries()) {
    const current = new Set(snapshot.incidents?.map((incident) => {
      return incident.id;
    }));
    if (index > 0) {
      for (const id of current) {
        if (!previous.has(id)) {
          added++;
        }
      }
      for (const id of previous) {
        if (!current.has(id)) {
          removed++;
        }
      }
    }
    previous = current;
  }
  return { added, removed };
}

export function incidentTransitions(
  baseline: SourceSnapshot | null,
  end: SourceSnapshot | null,
  history: { snapshots: SourceSnapshot[]; truncated: boolean },
  latest: SourceSnapshot | null,
  now: Date,
  isToday: boolean,
): Pick<SourceIncidentChangesResponse, "totals" | "netChange" | "coverage"> {
  const reasons: Coverage["reasons"] = [];
  if (!baseline) {
    reasons.push("missing_baseline");
  }
  if (!end) {
    reasons.push("missing_end");
  }
  if (history.truncated) {
    reasons.push("capture_limit_exceeded");
  }
  const snapshots = baseline ? [baseline, ...history.snapshots] : [...history.snapshots];
  if (end && snapshots.at(-1)?.observedAt !== end.observedAt) {
    snapshots.push(end);
  }
  if ((end !== null && end.incidents === undefined) || snapshots.some((snapshot) => {
    return snapshot.incidents === undefined;
  })) {
    reasons.push("missing_incident_details");
  }
  // The bounded range must reach the selected end, including its original timestamp.
  const last = history.snapshots.at(-1);
  if (baseline && end && (last?.observedAt !== end.observedAt || last?.count !== end.count)) {
    reasons.push("missing_history");
  }
  const gaps: Coverage["gaps"] = [];
  for (let index = 1; index < snapshots.length; index++) {
    const previous = snapshots[index - 1];
    const current = snapshots[index];
    const minutes = (Date.parse(current.observedAt) - Date.parse(previous.observedAt)) / 60_000;
    if (minutes > GAP_THRESHOLD_MINUTES) {
      gaps.push({
        fromObservedAt: previous.observedAt,
        toObservedAt: current.observedAt,
        minutes,
      });
    }
  }
  return {
    totals: reasons.length === 0 ? countTransitions(snapshots) : null,
    netChange: baseline && end ? end.count - baseline.count : null,
    coverage: {
      status: reasons.length === 0 ? "observed" : "unavailable",
      reasons,
      retainedCaptureCount: snapshots.length,
      detailedCaptureCount: snapshots.filter((snapshot) => {
        return snapshot.incidents !== undefined;
      }).length,
      gapThresholdMinutes: GAP_THRESHOLD_MINUTES,
      gaps,
      failedChecks: "not_recorded",
      continuity: "unknown",
      latestObservedAt: latest?.observedAt ?? null,
      stale: isToday && latest
        ? now.getTime() - Date.parse(latest.observedAt) > STALE_AFTER_MINUTES * 60_000
        : null,
      staleAfterMinutes: STALE_AFTER_MINUTES,
    },
  };
}
