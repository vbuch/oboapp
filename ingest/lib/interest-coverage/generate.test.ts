import { describe, it, expect, vi } from "vitest";
import { generateInterestReport } from "./generate";

function dependencies() {
  return {
    readRevision: vi.fn().mockResolvedValue({ revision: "a", pending: 0 }),
    readInterests: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
  };
}
describe("report generation concurrency", () => {
  it("publishes an unavailable replacement rather than leaving an old map", async () => {
    const deps = dependencies();
    await generateInterestReport(deps, "bg.sofia");
    expect(deps.save).toHaveBeenCalledWith(expect.objectContaining({ status: "unavailable", cells: [], summary: null }));
  });
  it("does not publish during a mutation", async () => {
    const deps = dependencies();
    deps.readRevision.mockResolvedValue({ revision: "a", pending: 1 });
    await expect(generateInterestReport(deps, "bg.sofia")).rejects.toThrow("mutation in progress");
    expect(deps.readInterests).not.toHaveBeenCalled();
    expect(deps.save).not.toHaveBeenCalled();
  });
  it("rejects a mutation completed during aggregation", async () => {
    const deps = dependencies();
    deps.readRevision.mockResolvedValueOnce({ revision: "a", pending: 0 }).mockResolvedValueOnce({ revision: "b", pending: 0 });
    await expect(generateInterestReport(deps, "bg.sofia")).rejects.toThrow("changed");
    expect(deps.save).not.toHaveBeenCalled();
  });
  it("keeps dry-runs read-only", async () => {
    const deps = dependencies();
    await generateInterestReport(deps, "bg.sofia", true);
    expect(deps.save).not.toHaveBeenCalled();
  });
});
