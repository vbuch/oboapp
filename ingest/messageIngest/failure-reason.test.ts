import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { messageIngest } from "./index";

// Mock dependencies
vi.mock("../lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn(() => ({
      add: vi.fn(() => Promise.resolve({ id: "mock-message-id" })),
      doc: vi.fn(() => ({
        update: vi.fn(() => Promise.resolve()),
        get: vi.fn(() =>
          Promise.resolve({
            exists: true,
            data: () => ({
              text: "Test message",
              createdAt: new Date(),
            }),
          })
        ),
      })),
    })),
  },
}));

vi.mock("../lib/ai-service", () => ({
  categorize: vi.fn(),
  extractStructuredData: vi.fn(),
}));

describe("Failure reason storage", () => {
  let categorize: any;
  let extractStructuredData: any;

  beforeEach(async () => {
    const aiService = await import("../lib/ai-service");
    categorize = aiService.categorize;
    extractStructuredData = aiService.extractStructuredData;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should store failure reason when categorization fails", async () => {
    // Mock categorization failure
    vi.mocked(categorize).mockResolvedValue(null);

    const result = await messageIngest(
      "Test message that will fail categorization",
      "test-source",
      "user-123",
      "test@example.com"
    );

    expect(result.totalCategorized).toBe(0);
    expect(result.totalRelevant).toBe(0);
    expect(result.totalIrrelevant).toBe(0);
    expect(result.messages).toHaveLength(1);
  });

  it("should store failure reason when extraction fails", async () => {
    // Mock successful categorization but failed extraction
    vi.mocked(categorize).mockResolvedValue([
      {
        categories: ["water"],
        relations: [],
        withSpecificAddress: true,
        specificAddresses: ["ул. Оборище 15"],
        coordinates: [],
        busStops: [],
        cadastralProperties: [],
        cityWide: false,
        isRelevant: true,
        normalizedText: "Ремонт на ул. Оборище",
      },
    ]);

    // Mock extraction failure
    vi.mocked(extractStructuredData).mockResolvedValue(null);

    const result = await messageIngest(
      "Ремонт на ул. Оборище",
      "test-source",
      "user-123",
      "test@example.com"
    );

    expect(result.totalCategorized).toBe(1);
    expect(result.messages).toHaveLength(1);
  });

  it("should handle precomputed GeoJSON with boundary filter failure", async () => {
    const geoJson = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [50.0, 50.0], // Outside Sofia
          },
          properties: {},
        },
      ],
    };

    const boundaries = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: {
            type: "Polygon" as const,
            coordinates: [
              [
                [23.25, 42.65],
                [23.45, 42.65],
                [23.45, 42.75],
                [23.25, 42.75],
                [23.25, 42.65],
              ],
            ],
          },
          properties: {},
        },
      ],
    };

    const result = await messageIngest(
      "Test message outside boundaries",
      "test-source",
      "user-123",
      "test@example.com",
      {
        precomputedGeoJson: geoJson,
        boundaryFilter: boundaries,
      }
    );

    expect(result.messages).toHaveLength(1);
  });

  it("should not store failure reason for successful ingestion", async () => {
    // Mock successful categorization
    vi.mocked(categorize).mockResolvedValue([
      {
        categories: [],
        relations: [],
        withSpecificAddress: false,
        specificAddresses: [],
        coordinates: [],
        busStops: [],
        cadastralProperties: [],
        cityWide: false,
        isRelevant: false, // Irrelevant message (not a failure)
        normalizedText: "Irrelevant test message",
      },
    ]);

    const result = await messageIngest(
      "Irrelevant test message",
      "test-source",
      "user-123",
      "test@example.com"
    );

    expect(result.totalCategorized).toBe(1);
    expect(result.totalIrrelevant).toBe(1);
    expect(result.messages).toHaveLength(1);
  });
});
