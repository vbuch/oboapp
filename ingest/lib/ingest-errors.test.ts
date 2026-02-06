import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildIngestErrorsField,
  createIngestErrorCollector,
  formatIngestErrorText,
  getIngestErrorRecorder,
  truncateIngestPayload,
} from "./ingest-errors";
import { logger } from "@/lib/logger";

describe("ingest-errors", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("records warnings, errors, and exceptions", () => {
    const collector = createIngestErrorCollector();

    collector.warn("⚠️  Partial geocoding");
    collector.error("❌ Failed to extract");
    collector.exception("Ingestion exception: test");

    expect(warnSpy).toHaveBeenCalledWith("⚠️  Partial geocoding", {
      component: "ingest",
    });
    expect(errorSpy).toHaveBeenCalledWith("❌ Failed to extract", {
      component: "ingest",
    });
    expect(errorSpy).toHaveBeenCalledWith("Ingestion exception: test", {
      component: "ingest",
      errorType: "exception",
    });

    expect(collector.entries).toEqual([
      { text: "⚠️  Partial geocoding", type: "warning" },
      { text: "❌ Failed to extract", type: "error" },
      { text: "Ingestion exception: test", type: "exception" },
    ]);
  });

  it("builds ingestErrors field only when entries exist", () => {
    const emptyCollector = createIngestErrorCollector();
    expect(buildIngestErrorsField(emptyCollector)).toEqual({});

    const collector = createIngestErrorCollector();
    collector.warn("⚠️  Partial geocoding");

    expect(buildIngestErrorsField(collector)).toEqual({
      ingestErrors: [{ text: "⚠️  Partial geocoding", type: "warning" }],
    });
  });

  it("formats error text from different inputs", () => {
    expect(formatIngestErrorText(new Error("Boom"))).toBe("Boom");
    expect(formatIngestErrorText("plain text")).toBe("plain text");
    expect(formatIngestErrorText({ code: 500 })).toBe("[object Object]");
  });

  it("truncates large payloads with length metadata", () => {
    const input = "a".repeat(10);
    expect(truncateIngestPayload(input, 20)).toEqual({
      summary: input,
      originalLength: 10,
    });

    const longInput = "b".repeat(30);
    expect(truncateIngestPayload(longInput, 10)).toEqual({
      summary: `${"b".repeat(10)}…`,
      originalLength: 30,
    });
  });

  it("returns a recorder that logs without a collector", () => {
    const recorder = getIngestErrorRecorder();

    recorder.warn("⚠️  Warning");
    recorder.error("❌ Error");
    recorder.exception("Exception");

    expect(warnSpy).toHaveBeenCalledWith("⚠️  Warning", {
      component: "ingest",
    });
    expect(errorSpy).toHaveBeenCalledWith("❌ Error", {
      component: "ingest",
    });
    expect(errorSpy).toHaveBeenCalledWith("Exception", {
      component: "ingest",
      errorType: "exception",
    });
  });
});
