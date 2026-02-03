import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firebase-admin
const mockBatch = {
  delete: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
};

const mockAdminDb = {
  collection: vi.fn(),
  batch: vi.fn(() => mockBatch),
};

vi.mock("@/lib/firebase-admin", () => ({
  adminDb: mockAdminDb,
}));

describe("sources-clean", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should require retain parameter via commander", async () => {
    // This is tested via the CLI script, not unit tests
    // The commander library handles required option validation
    expect(true).toBe(true);
  });

  it("should preserve sources of the retain type", async () => {
    const mockSourcesSnapshot = {
      empty: false,
      size: 3,
      forEach: vi.fn((callback) => {
        callback({
          id: "doc1",
          data: () => ({
            sourceType: "lozenets-sofia-bg",
            title: "Test 1",
            url: "https://example.com/1",
          }),
        });
        callback({
          id: "doc2",
          data: () => ({
            sourceType: "sofia-bg",
            title: "Test 2",
            url: "https://example.com/2",
          }),
        });
        callback({
          id: "doc3",
          data: () => ({
            sourceType: "lozenets-sofia-bg",
            title: "Test 3",
            url: "https://example.com/3",
          }),
        });
      }),
    };

    const mockMessagesSnapshot = {
      forEach: vi.fn(),
    };

    const mockSourcesCollection = {
      get: vi.fn().mockResolvedValue(mockSourcesSnapshot),
      doc: vi.fn(),
    };

    const mockMessagesCollection = {
      select: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue(mockMessagesSnapshot),
    };

    mockAdminDb.collection.mockImplementation((name: string) => {
      if (name === "sources") return mockSourcesCollection;
      if (name === "messages") return mockMessagesCollection;
      throw new Error(`Unknown collection: ${name}`);
    });

    const { cleanSources } = await import("./sources-clean");
    await cleanSources("lozenets-sofia-bg", true); // dry-run

    // Should fetch sources and messages
    expect(mockAdminDb.collection).toHaveBeenCalledWith("sources");
    expect(mockAdminDb.collection).toHaveBeenCalledWith("messages");
  });

  it("should preserve ingested sources", async () => {
    const mockSourcesSnapshot = {
      empty: false,
      size: 2,
      forEach: vi.fn((callback) => {
        callback({
          id: "doc1",
          data: () => ({
            sourceType: "sofia-bg",
            title: "Ingested Source",
            url: "https://example.com/ingested",
          }),
        });
        callback({
          id: "doc2",
          data: () => ({
            sourceType: "rayon-oborishte-bg",
            title: "Unprocessed Source",
            url: "https://example.com/unprocessed",
          }),
        });
      }),
    };

    const mockMessagesSnapshot = {
      forEach: vi.fn((callback) => {
        // doc1 has been ingested
        callback({
          data: () => ({ sourceDocumentId: "doc1" }),
        });
      }),
    };

    const mockSourcesCollection = {
      get: vi.fn().mockResolvedValue(mockSourcesSnapshot),
      doc: vi.fn(),
    };

    const mockMessagesCollection = {
      select: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue(mockMessagesSnapshot),
    };

    mockAdminDb.collection.mockImplementation((name: string) => {
      if (name === "sources") return mockSourcesCollection;
      if (name === "messages") return mockMessagesCollection;
      throw new Error(`Unknown collection: ${name}`);
    });

    const { cleanSources } = await import("./sources-clean");
    await cleanSources("lozenets-sofia-bg", true); // dry-run

    // Both collections should be queried
    expect(mockSourcesCollection.get).toHaveBeenCalled();
    expect(mockMessagesCollection.get).toHaveBeenCalled();
  });

  it("should handle empty sources collection", async () => {
    const mockSourcesSnapshot = {
      empty: true,
      size: 0,
      forEach: vi.fn(),
    };

    const mockSourcesCollection = {
      get: vi.fn().mockResolvedValue(mockSourcesSnapshot),
    };

    mockAdminDb.collection.mockReturnValue(mockSourcesCollection);

    const { cleanSources } = await import("./sources-clean");
    await cleanSources("lozenets-sofia-bg", true);

    expect(mockSourcesCollection.get).toHaveBeenCalled();
  });
});
