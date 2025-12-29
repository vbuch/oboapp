import { describe, expect, it } from "vitest";
import { formatDate, buildMessage, buildUrl, buildTitle } from "./builders";
import type { ToploIncidentInfo } from "./types";

describe("toplo-bg/builders", () => {
  describe("formatDate", () => {
    it("should format ISO date to Bulgarian locale", () => {
      const result = formatDate("2025-12-29T10:00:00");
      expect(result).toContain("2025");
      expect(result).toContain("декември");
      expect(result).toContain("29");
      expect(result).toContain("10:00");
    });

    it("should format date with timezone correctly", () => {
      const result = formatDate("2025-01-15T14:30:00+02:00");
      expect(result).toContain("2025");
      expect(result).toContain("януари");
    });
  });

  describe("buildMessage", () => {
    it("should build message with all fields", () => {
      const message = buildMessage(
        "Авария на топлопровод",
        "2025-12-29T10:00:00",
        "ул. Иван Вазов 10, София",
        "2025-12-29T18:00:00"
      );

      expect(message).toContain("Авария на топлопровод");
      expect(message).toContain("29 декември 2025");
      expect(message).toContain("ул. Иван Вазов 10, София");
      expect(message).toContain("Очаквано възстановяване");
    });

    it("should build message without untilDate", () => {
      const message = buildMessage(
        "Планиран ремонт",
        "2025-12-29T10:00:00",
        "бул. България 50",
        null
      );

      expect(message).toContain("Планиран ремонт");
      expect(message).toContain("бул. България 50");
      expect(message).not.toContain("Очаквано възстановяване");
    });

    it("should include line breaks", () => {
      const message = buildMessage(
        "Test",
        "2025-12-29T10:00:00",
        "Address",
        null
      );

      const lines = message.split("\n");
      expect(lines.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("buildUrl", () => {
    it("should build URL from contentItemId", () => {
      const url = buildUrl("12345");
      expect(url).toBe("https://toplo.bg/incidents/12345");
    });

    it("should handle different ID formats", () => {
      const url = buildUrl("abc-def-123");
      expect(url).toBe("https://toplo.bg/incidents/abc-def-123");
    });
  });

  describe("buildTitle", () => {
    it("should return incident name as title", () => {
      const info: ToploIncidentInfo = {
        AccidentId: "acc-1",
        ContentItemId: "123",
        Name: "Авария на топлопровод",
        FromDate: "2025-12-29T10:00:00",
        Addresses: "ул. Иван Вазов 10",
        UntilDate: null,
        GeolocationSerialized: "",
        Type: 1,
        Status: 1,
        AffectedService: null,
        Region: "Sofia",
        Locally: false,
        CreatedOn: "2025-12-29T09:00:00",
      };

      expect(buildTitle(info)).toBe("Авария на топлопровод");
    });

    it("should handle empty name", () => {
      const info: ToploIncidentInfo = {
        AccidentId: "acc-2",
        ContentItemId: "123",
        Name: "",
        FromDate: "2025-12-29T10:00:00",
        Addresses: "Test",
        UntilDate: null,
        GeolocationSerialized: "",
        Type: 1,
        Status: 1,
        AffectedService: null,
        Region: "Sofia",
        Locally: false,
        CreatedOn: "2025-12-29T09:00:00",
      };

      expect(buildTitle(info)).toBe("");
    });
  });
});
