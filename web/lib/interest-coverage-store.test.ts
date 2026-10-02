import { beforeEach, describe, it, expect, vi } from "vitest";
import { INTEREST_REPORT_PATH, INTEREST_REVISION_PATH } from "@oboapp/shared";
import { loadCurrentInterestReport, withInterestReportMutation } from "./interest-coverage-store";

const mock = vi.hoisted(() => ({
  revision: undefined as { revision: string; pending: number } | undefined,
  generation: 0,
  report: undefined as unknown,
  failWrite: false,
  conflict: false,
  afterDownload: undefined as (() => void) | undefined,
  disappearPinned: false,
  disappearPinnedOnce: false,
}));

vi.mock("@google-cloud/storage", () => ({
  Storage: class {
    bucket() {
      return { file(path: string, options?: { generation: number | string }) {
        return {
          async getMetadata() {
            if (!mock.revision) throw Object.assign(new Error("not found"), { code: 404 });
            return [{ generation: String(mock.generation) }];
          },
          async download() {
            if (path === INTEREST_REPORT_PATH) {
              if (!mock.report) throw Object.assign(new Error("missing"), { code: 404 });
              const content = Buffer.from(JSON.stringify(mock.report));
              mock.afterDownload?.();
              return [content];
            }
            if (mock.disappearPinned) throw Object.assign(new Error("overwritten generation"), { code: 404 });
            if (mock.disappearPinnedOnce) {
              mock.disappearPinnedOnce = false;
              mock.generation++;
              mock.revision = { revision: "concurrent", pending: 1 };
              throw Object.assign(new Error("overwritten generation"), { code: 404 });
            }
            if (path !== INTEREST_REVISION_PATH || !mock.revision || (options && Number(options.generation) !== mock.generation)) {
              throw Object.assign(new Error("not found"), { code: 404 });
            }
            return [Buffer.from(JSON.stringify(mock.revision))];
          },
          async save(content: string, options: { preconditionOpts: { ifGenerationMatch: number | string } }) {
            if (mock.failWrite) throw new Error("GCS write failed");
            if (mock.conflict) {
              mock.conflict = false;
              mock.generation++;
              mock.revision = { revision: "concurrent", pending: 1 };
            }
            if (Number(options.preconditionOpts.ifGenerationMatch) !== mock.generation) throw Object.assign(new Error("conflict"), { code: 412 });
            mock.revision = JSON.parse(content);
            mock.generation++;
          },
        };
      } };
    }
  },
}));

function unavailableReport(sourceRevision = "a") {
  return { version: 1, locality: "bg.sofia", generatedAt: new Date().toISOString(), sourceRevision, gridMeters: 2000, status: "unavailable", summary: null, cells: [] };
}

describe("interest report invalidation", () => {
  beforeEach(() => {
    vi.stubEnv("GCS_GENERIC_BUCKET", "test-bucket");
    mock.revision = { revision: "a", pending: 0 };
    mock.generation = 1;
    mock.report = unavailableReport();
    mock.failWrite = false;
    mock.conflict = false;
    mock.afterDownload = undefined;
    mock.disappearPinned = false;
    mock.disappearPinnedOnce = false;
  });
  it("serves only the current revision and withholds pending and missing reports", async () => {
    expect(await loadCurrentInterestReport()).toMatchObject({ sourceRevision: "a" });
    mock.revision = { revision: "b", pending: 0 };
    expect(await loadCurrentInterestReport()).toBeNull();
    mock.revision.pending = 1;
    expect(await loadCurrentInterestReport()).toBeNull();
    mock.revision.pending = 0;
    mock.report = undefined;
    expect(await loadCurrentInterestReport()).toBeNull();
  });
  it("rejects malformed snapshots containing raw fields", async () => {
    mock.report = { ...unavailableReport(), interests: [{ userId: "secret", coordinates: { lat: 42.7, lng: 23.3 } }] };
    await expect(loadCurrentInterestReport()).rejects.toThrow();
  });
  it("detects source changes during report download", async () => {
    mock.afterDownload = () => { mock.revision = { revision: "b", pending: 0 }; mock.generation++; };
    expect(await loadCurrentInterestReport()).toBeNull();
  });
  it("does not mistake an overwritten pinned marker for an absent marker", async () => {
    mock.disappearPinned = true;
    mock.report = unavailableReport("initial");
    await expect(loadCurrentInterestReport()).rejects.toThrow("overwritten generation");
  });
  it("withholds expired and future-dated reports", async () => {
    mock.report = { ...unavailableReport(), generatedAt: new Date(Date.now() - 46 * 24 * 60 * 60 * 1000).toISOString() };
    expect(await loadCurrentInterestReport()).toBeNull();
    mock.report = { ...unavailableReport(), generatedAt: new Date(Date.now() + 60_000).toISOString() };
    expect(await loadCurrentInterestReport()).toBeNull();
  });
  it("invalidates before writing and leaves the old snapshot unavailable after writing", async () => {
    await withInterestReportMutation(async () => {
      expect(mock.revision?.pending).toBe(1);
      expect(await loadCurrentInterestReport()).toBeNull();
    });
    expect(mock.revision?.pending).toBe(0);
    expect(await loadCurrentInterestReport()).toBeNull();
  });
  it("retries CAS conflicts without losing another mutation's pending count", async () => {
    mock.conflict = true;
    await withInterestReportMutation(async () => { expect(mock.revision?.pending).toBe(2); });
    expect(mock.revision?.pending).toBe(1);
  });
  it("retries an overwritten pinned read during mutation tracking", async () => {
    mock.disappearPinnedOnce = true;
    await withInterestReportMutation(async () => { expect(mock.revision?.pending).toBe(2); });
    expect(mock.revision?.pending).toBe(1);
  });
  it("blocks a database mutation if initial invalidation fails", async () => {
    mock.failWrite = true;
    const mutation = vi.fn();
    await expect(withInterestReportMutation(mutation)).rejects.toThrow("GCS write failed");
    expect(mutation).not.toHaveBeenCalled();
  });
  it("keeps the report unavailable if completion fails", async () => {
    await expect(withInterestReportMutation(async () => { mock.failWrite = true; })).rejects.toThrow("GCS write failed");
    expect(mock.revision?.pending).toBe(1);
    expect(await loadCurrentInterestReport()).toBeNull();
  });
  it("releases pending state after a failed DB write without restoring the old revision", async () => {
    await expect(withInterestReportMutation(async () => { throw new Error("DB failed"); })).rejects.toThrow("DB failed");
    expect(mock.revision?.pending).toBe(0);
    expect(await loadCurrentInterestReport()).toBeNull();
  });
  it("leaves non-report instances' mutations independent of GCS", async () => {
    vi.stubEnv("GCS_GENERIC_BUCKET", "");
    mock.failWrite = true;
    const mutation = vi.fn().mockResolvedValue("created");
    expect(await withInterestReportMutation(mutation)).toBe("created");
  });
});
