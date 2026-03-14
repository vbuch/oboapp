import { describe, it, expect, vi, beforeEach } from "vitest";
import { findBestMatch } from "./match";

vi.mock("./candidates", () => ({
  findCandidateEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock("./score", () => ({
  computeMatchScore: vi.fn().mockReturnValue({
    score: 0,
    signals: { locationSimilarity: 0, timeOverlap: 0, categoryMatch: 0, textSimilarity: 0 },
  }),
}));

import { findCandidateEvents } from "./candidates";
import { computeMatchScore } from "./score";

const mockDb = {} as any;

describe("findBestMatch", () => {
  beforeEach(() => {
    vi.mocked(findCandidateEvents).mockReset().mockResolvedValue([]);
    vi.mocked(computeMatchScore).mockReset().mockReturnValue({
      score: 0,
      signals: { locationSimilarity: 0, timeOverlap: 0, categoryMatch: 0, textSimilarity: 0 },
    });
  });

  it("returns null when no candidates", async () => {
    const result = await findBestMatch(mockDb, {
      locality: "bg.sofia",
      geoJson: null,
    });
    expect(result).toBeNull();
  });

  it("returns null when all candidates score below threshold", async () => {
    vi.mocked(findCandidateEvents).mockResolvedValueOnce([
      { _id: "evt-1" },
    ]);
    vi.mocked(computeMatchScore).mockReturnValueOnce({
      score: 0.5,
      signals: { locationSimilarity: 0.5, timeOverlap: 0.5, categoryMatch: 0, textSimilarity: 0 },
    });

    const result = await findBestMatch(mockDb, {
      locality: "bg.sofia",
      geoJson: null,
    });
    expect(result).toBeNull();
  });

  it("returns best match when above threshold", async () => {
    vi.mocked(findCandidateEvents).mockResolvedValueOnce([
      { _id: "evt-1" },
    ]);
    vi.mocked(computeMatchScore).mockReturnValueOnce({
      score: 0.85,
      signals: { locationSimilarity: 0.9, timeOverlap: 0.8, categoryMatch: 1.0, textSimilarity: 0 },
    });

    const result = await findBestMatch(mockDb, {
      locality: "bg.sofia",
      geoJson: null,
    });
    expect(result).not.toBeNull();
    expect(result!.event._id).toBe("evt-1");
    expect(result!.score).toBe(0.85);
  });

  it("picks highest scoring candidate when multiple match", async () => {
    vi.mocked(findCandidateEvents).mockResolvedValueOnce([
      { _id: "evt-1" },
      { _id: "evt-2" },
    ]);
    vi.mocked(computeMatchScore)
      .mockReturnValueOnce({
        score: 0.75,
        signals: { locationSimilarity: 0.7, timeOverlap: 0.7, categoryMatch: 1.0, textSimilarity: 0 },
      })
      .mockReturnValueOnce({
        score: 0.92,
        signals: { locationSimilarity: 1.0, timeOverlap: 0.9, categoryMatch: 1.0, textSimilarity: 0 },
      });

    const result = await findBestMatch(mockDb, {
      locality: "bg.sofia",
      geoJson: null,
    });
    expect(result!.event._id).toBe("evt-2");
    expect(result!.score).toBe(0.92);
  });
});
