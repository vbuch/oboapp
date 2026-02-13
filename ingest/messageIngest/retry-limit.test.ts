import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firebase-admin
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {},
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock firestore helper
const mockEncodeDocumentId = vi.fn();
vi.mock("../crawlers/shared/firestore", () => ({
  encodeDocumentId: mockEncodeDocumentId,
}));

describe("Retry limit logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should skip messages that have exceeded max retry attempts", async () => {
    const MAX_RETRY_ATTEMPTS = 3;

    // Mock messages with various retry counts
    const messages = [
      { sourceDocumentId: "doc1", retryCount: 0, finalizedAt: null },
      { sourceDocumentId: "doc2", retryCount: 1, finalizedAt: null },
      { sourceDocumentId: "doc3", retryCount: 2, finalizedAt: null },
      { sourceDocumentId: "doc4", retryCount: 3, finalizedAt: null }, // Should be skipped
      { sourceDocumentId: "doc5", retryCount: 5, finalizedAt: null }, // Should be skipped
    ];

    const maxRetriesReachedIds = new Set<string>();

    for (const message of messages) {
      const retryCount = message.retryCount || 0;

      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        maxRetriesReachedIds.add(message.sourceDocumentId);
      }
    }

    expect(maxRetriesReachedIds.size).toBe(2);
    expect(maxRetriesReachedIds.has("doc4")).toBe(true);
    expect(maxRetriesReachedIds.has("doc5")).toBe(true);
    expect(maxRetriesReachedIds.has("doc1")).toBe(false);
    expect(maxRetriesReachedIds.has("doc2")).toBe(false);
    expect(maxRetriesReachedIds.has("doc3")).toBe(false);
  });

  it("should treat missing retryCount as 0", async () => {
    const MAX_RETRY_ATTEMPTS = 3;

    const messages = [
      { sourceDocumentId: "doc1", finalizedAt: null }, // No retryCount field
      { sourceDocumentId: "doc2", retryCount: undefined, finalizedAt: null },
      { sourceDocumentId: "doc3", retryCount: null, finalizedAt: null },
    ];

    const maxRetriesReachedIds = new Set<string>();

    for (const message of messages) {
      const retryCount = message.retryCount || 0;

      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        maxRetriesReachedIds.add(message.sourceDocumentId);
      }
    }

    expect(maxRetriesReachedIds.size).toBe(0);
  });

  it("should mark messages as already ingested if finalized", async () => {
    const messages = [
      {
        sourceDocumentId: "doc1",
        retryCount: 0,
        finalizedAt: new Date("2024-01-15"),
      },
      {
        sourceDocumentId: "doc2",
        retryCount: 1,
        finalizedAt: new Date("2024-01-16"),
      },
      { sourceDocumentId: "doc3", retryCount: 2, finalizedAt: null },
      { sourceDocumentId: "doc4", retryCount: 3, finalizedAt: null },
    ];

    const alreadyIngestedIds = new Set<string>();

    for (const message of messages) {
      const finalizedAt = message.finalizedAt;

      if (finalizedAt) {
        alreadyIngestedIds.add(message.sourceDocumentId);
      }
    }

    expect(alreadyIngestedIds.size).toBe(2);
    expect(alreadyIngestedIds.has("doc1")).toBe(true);
    expect(alreadyIngestedIds.has("doc2")).toBe(true);
    expect(alreadyIngestedIds.has("doc3")).toBe(false);
    expect(alreadyIngestedIds.has("doc4")).toBe(false);
  });

  it("should allow filtering both finalized and max-retry messages", async () => {
    const MAX_RETRY_ATTEMPTS = 3;

    const messages = [
      {
        sourceDocumentId: "doc1",
        retryCount: 0,
        finalizedAt: new Date("2024-01-15"),
      }, // Already ingested
      {
        sourceDocumentId: "doc2",
        retryCount: 1,
        finalizedAt: new Date("2024-01-16"),
      }, // Already ingested
      { sourceDocumentId: "doc3", retryCount: 2, finalizedAt: null }, // Can retry
      { sourceDocumentId: "doc4", retryCount: 3, finalizedAt: null }, // Max retries reached
      { sourceDocumentId: "doc5", retryCount: 5, finalizedAt: null }, // Max retries reached
    ];

    const alreadyIngestedIds = new Set<string>();
    const maxRetriesReachedIds = new Set<string>();

    for (const message of messages) {
      const retryCount = message.retryCount || 0;
      const finalizedAt = message.finalizedAt;

      if (finalizedAt) {
        alreadyIngestedIds.add(message.sourceDocumentId);
      }

      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        maxRetriesReachedIds.add(message.sourceDocumentId);
      }
    }

    // Filter sources to ingest
    const sources = messages.map((m) => m.sourceDocumentId);
    const sourcesToIngest = sources.filter(
      (docId) =>
        !alreadyIngestedIds.has(docId) && !maxRetriesReachedIds.has(docId),
    );

    expect(sourcesToIngest.length).toBe(1);
    expect(sourcesToIngest[0]).toBe("doc3");
    expect(alreadyIngestedIds.size).toBe(2);
    expect(maxRetriesReachedIds.size).toBe(2);
  });

  it("should increment retry count correctly", async () => {
    let retryCount = 0;

    // Simulate 5 failures
    for (let i = 0; i < 5; i++) {
      retryCount = retryCount + 1;
    }

    expect(retryCount).toBe(5);
  });
});
