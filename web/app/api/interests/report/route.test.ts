import { beforeEach, describe, it, expect, vi } from "vitest";
import { GET } from "./route";
import { loadCurrentInterestReport } from "@/lib/interest-coverage-store";

vi.mock("@/lib/interest-coverage-store", () => ({ loadCurrentInterestReport: vi.fn() }));
vi.mock("@/lib/report-pages", () => ({ hasReportPagesEnabled: () => true }));
describe("public interest report", () => {
  beforeEach(() => vi.clearAllMocks());
  it("requires no auth and strips the internal revision", async () => {
    vi.mocked(loadCurrentInterestReport).mockResolvedValue({ version: 1, locality: "bg.sofia", generatedAt: "2026-10-02T10:00:00.000Z", sourceRevision: "secret", gridMeters: 2000, status: "unavailable", summary: null, cells: [] });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty("sourceRevision");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("does not serve a missing, invalidated or unsafe report", async () => {
    vi.mocked(loadCurrentInterestReport).mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
