import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseTimespans } from "./timespan-parsing";
import type { PinRecord } from "./types";
import { logger } from "@/lib/logger";

describe("parseTimespans", () => {
  const mockPin: PinRecord = {
    lat: 42.6977,
    lon: 23.3219,
    eventId: "SF_1234",
    typedist: "непланирано",
    begin_event: "",
    end_event: "",
    city_name: "София",
    cities: "",
  };

  let loggerWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    loggerWarnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    loggerWarnSpy.mockRestore();
  });

  it("should parse valid begin_event and end_event", () => {
    const pin: PinRecord = {
      ...mockPin,
      begin_event: "29.01.2026 10:00",
      end_event: "29.01.2026 14:00",
    };

    const result = parseTimespans(pin);

    expect(result.timespanStart).toEqual(new Date("2026-01-29T10:00:00"));
    expect(result.timespanEnd).toEqual(new Date("2026-01-29T14:00:00"));
  });

  it("should use start time for end when end_event is missing", () => {
    const pin: PinRecord = {
      ...mockPin,
      begin_event: "29.01.2026 10:00",
      end_event: "",
    };

    const result = parseTimespans(pin);

    expect(result.timespanStart).toEqual(new Date("2026-01-29T10:00:00"));
    expect(result.timespanEnd).toEqual(new Date("2026-01-29T10:00:00"));
  });

  it("should default to current time when both dates are missing", () => {
    const pin: PinRecord = {
      ...mockPin,
      begin_event: "",
      end_event: "",
    };

    const beforeCall = new Date();
    const result = parseTimespans(pin);
    const afterCall = new Date();

    // Should be close to current time (within a few ms)
    expect(result.timespanStart.getTime()).toBeGreaterThanOrEqual(
      beforeCall.getTime(),
    );
    expect(result.timespanStart.getTime()).toBeLessThanOrEqual(
      afterCall.getTime(),
    );
    expect(result.timespanEnd).toEqual(result.timespanStart);
  });

  it("should warn and default to current time on invalid begin_event format", () => {
    const pin: PinRecord = {
      ...mockPin,
      begin_event: "invalid-date",
      end_event: "",
    };

    const beforeCall = new Date();
    const result = parseTimespans(pin);

    expect(loggerWarnSpy).toHaveBeenCalledWith(
      "Invalid begin_event",
      expect.objectContaining({ eventId: "SF_1234" }),
    );
    expect(result.timespanStart.getTime()).toBeGreaterThanOrEqual(
      beforeCall.getTime(),
    );
  });

  it("should warn and use start time when end_event is invalid", () => {
    const pin: PinRecord = {
      ...mockPin,
      begin_event: "29.01.2026 10:00",
      end_event: "invalid-date",
    };

    const result = parseTimespans(pin);

    expect(loggerWarnSpy).toHaveBeenCalledWith(
      "Invalid end_event",
      expect.objectContaining({ eventId: "SF_1234" }),
    );
    expect(result.timespanStart).toEqual(new Date("2026-01-29T10:00:00"));
    expect(result.timespanEnd).toEqual(result.timespanStart);
  });

  it("should warn when begin_event is outside valid range", () => {
    const pin: PinRecord = {
      ...mockPin,
      begin_event: "01.01.1900 10:00", // Too far in past
      end_event: "",
    };

    parseTimespans(pin);

    expect(loggerWarnSpy).toHaveBeenCalledWith(
      "begin_event outside valid range",
      expect.objectContaining({ eventId: "SF_1234" }),
    );
  });

  it("should warn when end_event is outside valid range", () => {
    const pin: PinRecord = {
      ...mockPin,
      begin_event: "29.01.2026 10:00",
      end_event: "01.01.2020 10:00", // Before 2025-01-01 minimum
    };

    const result = parseTimespans(pin);

    expect(loggerWarnSpy).toHaveBeenCalledWith(
      "end_event outside valid range",
      expect.objectContaining({ eventId: "SF_1234" }),
    );
    // Should fall back to start time
    expect(result.timespanEnd).toEqual(result.timespanStart);
  });

  it("should handle end time before start time", () => {
    const pin: PinRecord = {
      ...mockPin,
      begin_event: "29.01.2026 14:00",
      end_event: "29.01.2026 10:00",
    };

    const result = parseTimespans(pin);

    // Both should parse successfully, even if end < start
    expect(result.timespanStart).toEqual(new Date("2026-01-29T14:00:00"));
    expect(result.timespanEnd).toEqual(new Date("2026-01-29T10:00:00"));
  });
});
