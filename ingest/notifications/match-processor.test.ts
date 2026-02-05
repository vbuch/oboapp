import { describe, it, expect } from "vitest";
import { deduplicateMatches } from "./match-processor";
import type { MatchResult } from "./match-processor";

describe("match-processor", () => {
  describe("deduplicateMatches", () => {
    it("should keep match with smallest distance for same user-message pair", () => {
      const matches: MatchResult[] = [
        {
          messageId: "msg1",
          userId: "user1",
          interestId: "int1",
          distance: 500,
        },
        {
          messageId: "msg1",
          userId: "user1",
          interestId: "int2",
          distance: 300,
        },
        {
          messageId: "msg1",
          userId: "user1",
          interestId: "int3",
          distance: 700,
        },
      ];

      const result = deduplicateMatches(matches);

      expect(result).toHaveLength(1);
      expect(result[0].distance).toBe(300);
      expect(result[0].interestId).toBe("int2");
    });

    it("should keep separate matches for different users", () => {
      const matches: MatchResult[] = [
        {
          messageId: "msg1",
          userId: "user1",
          interestId: "int1",
          distance: 500,
        },
        {
          messageId: "msg1",
          userId: "user2",
          interestId: "int2",
          distance: 300,
        },
      ];

      const result = deduplicateMatches(matches);

      expect(result).toHaveLength(2);
    });

    it("should keep separate matches for different messages", () => {
      const matches: MatchResult[] = [
        {
          messageId: "msg1",
          userId: "user1",
          interestId: "int1",
          distance: 500,
        },
        {
          messageId: "msg2",
          userId: "user1",
          interestId: "int1",
          distance: 300,
        },
      ];

      const result = deduplicateMatches(matches);

      expect(result).toHaveLength(2);
    });

    it("should handle empty array", () => {
      const result = deduplicateMatches([]);

      expect(result).toHaveLength(0);
    });

    it("should handle single match", () => {
      const matches: MatchResult[] = [
        {
          messageId: "msg1",
          userId: "user1",
          interestId: "int1",
          distance: 500,
        },
      ];

      const result = deduplicateMatches(matches);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(matches[0]);
    });
  });
});
