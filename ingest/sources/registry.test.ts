// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceDefinition } from "@oboapp/shared";
import {
  getEmergentSourceIds,
  getSelectedSourceIds,
  runSelectedSource,
} from "./registry";

const { sources, crawl, load, loggerError } = vi.hoisted(() => ({
  sources: [] as SourceDefinition[],
  crawl: vi.fn(),
  load: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@oboapp/shared", () => ({ SOURCES: sources }));
vi.mock("@/lib/logger", () => ({ logger: { error: loggerError } }));
vi.mock("../crawlers/triaditsa-org/index.js", () => {
  load();
  return { crawl };
});
vi.mock("../crawlers/sensor-community/index.js", () => {
  throw new Error("An unselected implementation was imported");
});

beforeEach(() => {
  vi.clearAllMocks();
  sources.splice(0, sources.length, {
    id: "triaditsa-org",
    name: "Selected district",
    url: "https://example.com/district",
    localities: ["bg.plovdiv"],
  }, {
    id: "selected-water",
    name: "Selected water source",
    url: "https://example.com/water",
    localities: ["bg.plovdiv"],
    emergent: true,
  });
  crawl.mockResolvedValue(undefined);
});

describe("selected source runtime registry", () => {
  it("lists selected sources and schedule groups without loading implementations", () => {
    expect(getSelectedSourceIds()).toEqual(["triaditsa-org", "selected-water"]);
    expect(getEmergentSourceIds()).toEqual(["selected-water"]);
    expect(load).not.toHaveBeenCalled();
    expect(crawl).not.toHaveBeenCalled();
  });

  it("keeps caller changes to the returned IDs out of the selection", () => {
    getSelectedSourceIds().push("sensor-community");
    getEmergentSourceIds().push("triaditsa-org");

    expect(getSelectedSourceIds()).toEqual(["triaditsa-org", "selected-water"]);
    expect(getEmergentSourceIds()).toEqual(["selected-water"]);
  });

  it.each(["sensor-community", "unknown", "../triaditsa-org", "toString"])(
    "rejects the unselected ID %s before importing an implementation",
    async (sourceId) => {
      await expect(runSelectedSource(sourceId)).rejects.toThrow(
        `Source "${sourceId}" is not selected for this instance`,
      );
      expect(load).not.toHaveBeenCalled();
      expect(crawl).not.toHaveBeenCalled();
    },
  );

  it("loads and awaits a selected source on demand", async () => {
    await runSelectedSource("triaditsa-org");

    expect(load).toHaveBeenCalledOnce();
    expect(crawl).toHaveBeenCalledOnce();
  });

  it("logs the original source failure and rethrows it", async () => {
    const error = Object.assign(new TypeError("fetch failed"), {
      cause: { code: "ECONNRESET", message: "read ECONNRESET" },
    });
    crawl.mockRejectedValue(error);

    await expect(runSelectedSource("triaditsa-org")).rejects.toBe(error);

    expect(loggerError).toHaveBeenCalledExactlyOnceWith(
      "Selected source crawl failed",
      expect.objectContaining({
        source: "triaditsa-org",
        error,
      }),
    );
  });

  it("supports an empty instance selection", async () => {
    sources.splice(0);

    expect(getSelectedSourceIds()).toEqual([]);
    expect(getEmergentSourceIds()).toEqual([]);
    await expect(runSelectedSource("triaditsa-org")).rejects.toThrow(
      "is not selected for this instance",
    );
    expect(crawl).not.toHaveBeenCalled();
  });
});
