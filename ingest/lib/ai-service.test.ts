import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Test only the validation logic with direct imports
describe("categorize function validation", () => {
  let _mockGenerateContent: any;
  let originalEnv: any;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };

    // Set required environment variables
    process.env.GOOGLE_AI_MODEL = "gemini-1.5-flash";
    process.env.GOOGLE_AI_API_KEY = "mock-api-key";

    // Mock the generateContent function
    _mockGenerateContent = vi.fn();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it("should validate valid categorization response schema", async () => {
    const mockAiResponse = [
      {
        categories: ["water", "construction-and-repairs"],
        relations: ["метро", "строителство"],
        withSpecificAddress: true,
        specificAddresses: ["бул. Витоша 1"],
        coordinates: ["42.6977, 23.3219"],
        busStops: ["0001"],
        cadastralProperties: ["68134.501.123"],
        cityWide: false,
        isRelevant: true,
        normalizedText:
          "Спиране на водоснабдяването поради строителство на метро.",
      },
    ];

    // Import the schema for direct validation testing
    const { CategorizationResponseSchema } =
      await import("./categorize.schema");

    const result = CategorizationResponseSchema.safeParse(mockAiResponse);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toEqual(mockAiResponse);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].categories).toContain("water");
      expect(result.data[0].categories).toContain("construction-and-repairs");
    }
  });

  it("should reject invalid categorization response", async () => {
    const invalidAiResponse = [
      {
        categories: ["invalid-category"], // Invalid category
        withSpecificAddress: false,
        specificAddresses: [],
        coordinates: [],
        busStops: [],
        cadastralProperties: [],
        cityWide: false,
        isRelevant: true,
        normalizedText: "Test message",
      },
    ];

    const { CategorizationResponseSchema } =
      await import("./categorize.schema");

    const result = CategorizationResponseSchema.safeParse(invalidAiResponse);
    expect(result.success).toBe(false);
  });

  it("should reject invalid coordinate format", async () => {
    const invalidAiResponse = [
      {
        categories: ["water"],
        withSpecificAddress: true,
        specificAddresses: ["Test address"],
        coordinates: ["invalid-coordinate"], // Invalid coordinate format
        busStops: [],
        cadastralProperties: [],
        cityWide: false,
        isRelevant: true,
        normalizedText: "Test message",
      },
    ];

    const { CategorizationResponseSchema } =
      await import("./categorize.schema");

    const result = CategorizationResponseSchema.safeParse(invalidAiResponse);
    expect(result.success).toBe(false);
  });

  it("should handle multiple categorized messages", async () => {
    const mockAiResponse = [
      {
        categories: ["water"],
        withSpecificAddress: true,
        specificAddresses: ["бул. Витоша 1"],
        coordinates: [],
        busStops: [],
        cadastralProperties: [],
        cityWide: false,
        isRelevant: true,
        normalizedText: "Спиране на водоснабдяването.",
      },
      {
        categories: ["heating", "construction-and-repairs"],
        relations: ["зимна поддръжка"],
        withSpecificAddress: false,
        specificAddresses: [],
        coordinates: [],
        busStops: [],
        cadastralProperties: [],
        cityWide: true,
        isRelevant: true,
        normalizedText: "Планова поддръжка на отоплението в целия град.",
      },
    ];

    const { CategorizationResponseSchema } =
      await import("./categorize.schema");

    const result = CategorizationResponseSchema.safeParse(mockAiResponse);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].categories).toContain("water");
      expect(result.data[1].categories).toContain("heating");
      expect(result.data[1].categories).toContain("construction-and-repairs");
    }
  });

  it("should validate all predefined categories", async () => {
    const allCategories = [
      "air-quality",
      "art",
      "bicycles",
      "construction-and-repairs",
      "culture",
      "electricity",
      "health",
      "heating",
      "parking",
      "public-transport",
      "road-block",
      "sports",
      "traffic",
      "vehicles",
      "waste",
      "water",
      "weather",
    ];

    const mockAiResponse = [
      {
        categories: allCategories,
        withSpecificAddress: false,
        specificAddresses: [],
        coordinates: [],
        busStops: [],
        cadastralProperties: [],
        cityWide: false,
        isRelevant: true,
        normalizedText: "Test message with all categories.",
      },
    ];

    const { CategorizationResponseSchema } =
      await import("./categorize.schema");

    const result = CategorizationResponseSchema.safeParse(mockAiResponse);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data[0].categories).toHaveLength(17);
    }
  });
});
