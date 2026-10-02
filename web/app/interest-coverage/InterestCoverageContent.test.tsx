import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { makeInterestCoverageGrid } from "@oboapp/shared";
import InterestCoverageContent from "./InterestCoverageContent";

vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="coverage-map">Map</div> }));

const publicReport = {
  version: 1, locality: "bg.sofia", generatedAt: "2026-10-02T10:00:00.000Z", gridMeters: 2000,
  status: "available", summary: { users: { min: 10, max: 19 }, interests: { min: 20, max: 29 } },
  cells: [{ ...makeInterestCoverageGrid("bg.sofia").cells[0], users: { min: 10, max: 19 } }],
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("interest coverage page privacy states", () => {
  it("displays count bands and the report timestamp with a safe map", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(publicReport))));
    render(<InterestCoverageContent />);
    expect(screen.getByText("Зареждане на отчета…")).toBeInTheDocument();
    expect(await screen.findByTestId("coverage-map")).toBeInTheDocument();
    expect(screen.getByText("10–19")).toBeInTheDocument();
    expect(screen.getByText("20–29")).toBeInTheDocument();
    expect(document.querySelector("time")?.dateTime).toBe(publicReport.generatedAt);
  });
  it("clears the map when the next privacy refresh becomes unavailable", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(publicReport)))
      .mockResolvedValue(new Response('{"status":"unavailable"}', { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const timers = vi.spyOn(globalThis, "setTimeout");
    render(<InterestCoverageContent />);
    await screen.findByTestId("coverage-map");
    const refresh = timers.mock.calls.find((call) => call[1] === 60_000)?.[0];
    expect(typeof refresh).toBe("function");
    if (typeof refresh === "function") await act(async () => { refresh(); });
    await waitFor(() => expect(screen.queryByTestId("coverage-map")).not.toBeInTheDocument());
    expect(screen.getByText(/Картата временно не е достъпна/)).toBeInTheDocument();
    timers.mockRestore();
  });
  it("shows an unavailable state without counts or map", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...publicReport, status: "unavailable", cells: [], summary: null }))));
    render(<InterestCoverageContent />);
    expect(await screen.findByText(/Картата временно не е достъпна/)).toBeInTheDocument();
    expect(screen.queryByTestId("coverage-map")).not.toBeInTheDocument();
    expect(screen.queryByText("Запазени зони")).not.toBeInTheDocument();
  });
});
