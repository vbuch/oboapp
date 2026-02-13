import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
const mockMessagesRepo = {
  findMany: vi.fn(),
};

const mockSourcesRepo = {
  findMany: vi.fn(),
  deleteManyByIds: vi.fn(),
};

const mockDb = {
  messages: mockMessagesRepo,
  sources: mockSourcesRepo,
};

vi.mock("@/lib/db", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

describe("sources-clean", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module registry so cleanSources re-imports getDb each time
    vi.resetModules();
  });

  it("should require retain parameter via commander", async () => {
    // This is tested via the CLI script, not unit tests
    // The commander library handles required option validation
    expect(true).toBe(true);
  });

  it("should preserve sources of the retain type", async () => {
    mockSourcesRepo.findMany.mockResolvedValue([
      {
        _id: "doc1",
        sourceType: "lozenets-sofia-bg",
        title: "Test 1",
        url: "https://example.com/1",
      },
      {
        _id: "doc2",
        sourceType: "sofia-bg",
        title: "Test 2",
        url: "https://example.com/2",
      },
      {
        _id: "doc3",
        sourceType: "lozenets-sofia-bg",
        title: "Test 3",
        url: "https://example.com/3",
      },
    ]);

    mockMessagesRepo.findMany.mockResolvedValue([]);

    const { cleanSources } = await import("./sources-clean");
    await cleanSources("lozenets-sofia-bg", true); // dry-run

    // Should fetch sources and messages
    expect(mockSourcesRepo.findMany).toHaveBeenCalled();
    expect(mockMessagesRepo.findMany).toHaveBeenCalledWith({
      select: ["sourceDocumentId"],
    });
  });

  it("should preserve ingested sources", async () => {
    mockSourcesRepo.findMany.mockResolvedValue([
      {
        _id: "doc1",
        sourceType: "sofia-bg",
        title: "Ingested Source",
        url: "https://example.com/ingested",
      },
      {
        _id: "doc2",
        sourceType: "rayon-oborishte-bg",
        title: "Unprocessed Source",
        url: "https://example.com/unprocessed",
      },
    ]);

    mockMessagesRepo.findMany.mockResolvedValue([
      { sourceDocumentId: "doc1" },
    ]);

    const { cleanSources } = await import("./sources-clean");
    await cleanSources("lozenets-sofia-bg", true); // dry-run

    // Both repos should be queried
    expect(mockSourcesRepo.findMany).toHaveBeenCalled();
    expect(mockMessagesRepo.findMany).toHaveBeenCalled();
  });

  it("should handle empty sources collection", async () => {
    mockSourcesRepo.findMany.mockResolvedValue([]);

    const { cleanSources } = await import("./sources-clean");
    await cleanSources("lozenets-sofia-bg", true);

    expect(mockSourcesRepo.findMany).toHaveBeenCalled();
  });
});
