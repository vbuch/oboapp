import { describe, it, expect } from "vitest";
import { convertTimestamp } from "./utils";

describe("utils", () => {
  describe("convertTimestamp", () => {
    it("should convert Firestore _seconds format", () => {
      const timestamp = { _seconds: 1707134400 }; // 2024-02-05 12:00:00 UTC

      const result = convertTimestamp(timestamp);

      expect(result).toBe("2024-02-05T12:00:00.000Z");
    });

    it("should convert Firestore toDate format", () => {
      const mockDate = new Date("2024-02-05T12:00:00.000Z");
      const timestamp = {
        toDate: () => mockDate,
      };

      const result = convertTimestamp(timestamp);

      expect(result).toBe("2024-02-05T12:00:00.000Z");
    });

    it("should pass through ISO string", () => {
      const isoString = "2024-02-05T12:00:00.000Z";

      const result = convertTimestamp(isoString);

      expect(result).toBe(isoString);
    });

    it("should return current time for invalid input", () => {
      const beforeCall = Date.now();
      const result = convertTimestamp(null);
      const afterCall = Date.now();

      const resultTime = new Date(result).getTime();

      expect(resultTime).toBeGreaterThanOrEqual(beforeCall);
      expect(resultTime).toBeLessThanOrEqual(afterCall);
    });

    it("should return current time for undefined", () => {
      const beforeCall = Date.now();
      const result = convertTimestamp(undefined);
      const afterCall = Date.now();

      const resultTime = new Date(result).getTime();

      expect(resultTime).toBeGreaterThanOrEqual(beforeCall);
      expect(resultTime).toBeLessThanOrEqual(afterCall);
    });
  });
});
