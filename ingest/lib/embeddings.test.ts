import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @google/genai
const mockEmbedContent = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { embedContent: mockEmbedContent };
  },
}));

// Mock delay to avoid waiting
vi.mock("./delay", () => ({
  delay: vi.fn().mockResolvedValue(undefined),
}));

// Mock logger
vi.mock("./logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

import { generateEmbedding, _testInternals } from "./embeddings";

describe("generateEmbedding", () => {
  beforeEach(() => {
    mockEmbedContent.mockReset();
    _testInternals.resetClient();
  });

  it("returns embedding values from API response", async () => {
    const fakeValues = Array.from({ length: 768 }, (_, i) => i * 0.001);
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: fakeValues }],
    });

    const result = await generateEmbedding("test text");
    expect(result).toEqual(fakeValues);
    expect(mockEmbedContent).toHaveBeenCalledWith({
      model: _testInternals.EMBEDDING_MODEL,
      contents: "test text",
      config: { outputDimensionality: _testInternals.EMBEDDING_DIMENSIONS },
    });
  });

  it("returns null for empty text", async () => {
    const result = await generateEmbedding("   ");
    expect(result).toBeNull();
    expect(mockEmbedContent).not.toHaveBeenCalled();
  });

  it("returns null on API error", async () => {
    mockEmbedContent.mockRejectedValue(new Error("API error"));
    const result = await generateEmbedding("test");
    expect(result).toBeNull();
  });

  it("returns null when response has no embeddings", async () => {
    mockEmbedContent.mockResolvedValue({ embeddings: [] });
    const result = await generateEmbedding("test");
    expect(result).toBeNull();
  });

  it("returns null when embedding values are empty", async () => {
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: [] }],
    });
    const result = await generateEmbedding("test");
    expect(result).toBeNull();
  });
});
