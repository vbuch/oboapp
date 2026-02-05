import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";

// Mock the firebase-admin module
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

// Mock the messageIngest module
vi.mock("@/lib/messageIngest", () => ({
  verifyAuthToken: vi.fn(),
  validateMessageText: vi.fn(),
  messageIngest: vi.fn(),
}));

// Helper to create mock GeoJSON for testing
const createMockGeoJson = () => ({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [23.3394, 42.7035],
      },
      properties: {},
    },
  ],
});

// Format dates as DD.MM.YYYY HH:MM
const formatDate = (date: Date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year} 08:00`;
};

// Helper to create Firebase mock structure
const setupFirebaseMock = async (mockMessages: any[]) => {
  const { adminDb } = await import("@/lib/firebase-admin");

  let whereField: string | null = null;
  let whereOperator: string | null = null;
  let whereValue: any = null;

  const mockSnapshot = {
    forEach: vi.fn((callback) => {
      // Filter messages based on where clause if it was called
      const filteredMessages =
        whereField && whereOperator && whereValue
          ? mockMessages.filter((doc) => {
              const data = doc.data();
              const fieldValue = whereField ? data[whereField] : null;

              if (!fieldValue) return false;

              // Convert Firestore timestamp to Date for comparison
              const dateValue = fieldValue._seconds
                ? new Date(fieldValue._seconds * 1000)
                : fieldValue;

              if (whereOperator === ">=") {
                return dateValue >= whereValue;
              }
              return false;
            })
          : mockMessages;

      filteredMessages.forEach((doc) => callback(doc));
    }),
  };

  const mockGet = {
    get: vi.fn().mockResolvedValue(mockSnapshot),
  };

  // Support chained orderBy calls
  const mockOrderBy2 = {
    orderBy: vi.fn().mockReturnValue(mockGet),
  };

  const mockOrderBy1 = {
    orderBy: vi.fn().mockReturnValue(mockOrderBy2),
  };

  const mockCollection = {
    where: vi.fn((field, operator, value) => {
      whereField = field;
      whereOperator = operator;
      whereValue = value;
      return mockOrderBy1;
    }),
    orderBy: vi.fn().mockReturnValue(mockGet),
  };

  vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);
};

describe("GET /api/messages - Query Parameter Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject non-numeric coordinate values with 400", async () => {
    const mockRequest = new Request(
      "http://localhost/api/messages?north=invalid&south=42.6&east=23.4&west=23.3",
    );
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid query parameters");
  });

  it("should reject invalid zoom values (too low) with 400", async () => {
    const mockRequest = new Request(
      "http://localhost/api/messages?zoom=0",
    );
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid query parameters");
  });

  it("should reject invalid zoom values (too high) with 400", async () => {
    const mockRequest = new Request(
      "http://localhost/api/messages?zoom=23",
    );
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid query parameters");
  });

  it("should reject non-numeric zoom values with 400", async () => {
    const mockRequest = new Request(
      "http://localhost/api/messages?zoom=invalid",
    );
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid query parameters");
  });

  it("should reject invalid category names with 400", async () => {
    const mockRequest = new Request(
      "http://localhost/api/messages?categories=invalid-category,water",
    );
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid query parameters");
  });

  it("should accept valid category names (water,electricity)", async () => {
    // This test just validates that valid category names don't cause a 400 error
    // The actual filtering logic is tested in other test suites
    const mockRequest = new Request(
      "http://localhost/api/messages?categories=water,electricity",
    );
    const { searchParams } = new URL(mockRequest.url);
    const { messagesQuerySchema } = await import("@/lib/api-query.schema");
    const parsed = messagesQuerySchema.safeParse(
      Object.fromEntries(searchParams.entries()),
    );

    expect(parsed.success).toBe(true);
    expect(parsed.data?.categories).toEqual(["water", "electricity"]);
  });

  it("should accept 'uncategorized' as a special category value", async () => {
    // This test validates that 'uncategorized' is accepted as a valid value
    const mockRequest = new Request(
      "http://localhost/api/messages?categories=uncategorized",
    );
    const { searchParams } = new URL(mockRequest.url);
    const { messagesQuerySchema } = await import("@/lib/api-query.schema");
    const parsed = messagesQuerySchema.safeParse(
      Object.fromEntries(searchParams.entries()),
    );

    expect(parsed.success).toBe(true);
    expect(parsed.data?.categories).toEqual(["uncategorized"]);
  });

  it("should accept valid coordinate bounds", async () => {
    // This test validates that valid coordinates are accepted by the schema
    const mockRequest = new Request(
      "http://localhost/api/messages?north=42.75&south=42.65&east=23.45&west=23.25&zoom=15",
    );
    const { searchParams } = new URL(mockRequest.url);
    const { messagesQuerySchema } = await import("@/lib/api-query.schema");
    const parsed = messagesQuerySchema.safeParse(
      Object.fromEntries(searchParams.entries()),
    );

    expect(parsed.success).toBe(true);
    expect(parsed.data?.north).toBe(42.75);
    expect(parsed.data?.south).toBe(42.65);
    expect(parsed.data?.east).toBe(23.45);
    expect(parsed.data?.west).toBe(23.25);
    expect(parsed.data?.zoom).toBe(15);
  });
});

describe("GET /api/messages - Date Filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variable
    delete process.env.MESSAGE_RELEVANCE_DAYS;
  });

  it("should filter out messages with all timespans expired", async () => {
    // Create mock data - one message with expired timespans, one with current
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const expiredDate = new Date("2024-01-01");

    const mockMessages = [
      {
        id: "msg1",
        data: () => ({
          text: "Old disruption",
          extractedData: JSON.stringify({
            responsible_entity: "Test",
            pins: [
              {
                address: "ул. Тест 1",
                timespans: [
                  { start: "01.01.2024 08:00", end: "01.01.2024 18:00" },
                ],
              },
            ],
            streets: [],
          }),
          geoJson: JSON.stringify(createMockGeoJson()),
          createdAt: { _seconds: expiredDate.getTime() / 1000 },
          timespanEnd: { _seconds: expiredDate.getTime() / 1000 },
        }),
      },
      {
        id: "msg2",
        data: () => ({
          text: "Current disruption",
          extractedData: JSON.stringify({
            responsible_entity: "Test",
            pins: [
              {
                address: "ул. Тест 2",
                timespans: [
                  {
                    start: formatDate(yesterday),
                    end: formatDate(tomorrow),
                  },
                ],
              },
            ],
            streets: [],
          }),
          geoJson: JSON.stringify(createMockGeoJson()),
          createdAt: { _seconds: yesterday.getTime() / 1000 },
          timespanEnd: { _seconds: tomorrow.getTime() / 1000 },
        }),
      },
    ];

    await setupFirebaseMock(mockMessages);

    const mockRequest = new Request("http://localhost/api/messages");
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(data.messages).toHaveLength(1);
    expect(data.messages[0].id).toBe("msg2");
  });

  it("should show messages without timespans if they are within MESSAGE_RELEVANCE_DAYS", async () => {
    // Set relevance to 30 days
    process.env.MESSAGE_RELEVANCE_DAYS = "30";

    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 10); // 10 days ago

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 40); // 40 days ago

    const mockMessages = [
      {
        id: "msg1",
        data: () => ({
          text: "Recent message without timespans",
          geoJson: JSON.stringify(createMockGeoJson()),
          createdAt: { _seconds: recentDate.getTime() / 1000 },
          timespanEnd: { _seconds: recentDate.getTime() / 1000 }, // Falls back to createdAt
        }),
      },
      {
        id: "msg2",
        data: () => ({
          text: "Old message without timespans",
          geoJson: JSON.stringify(createMockGeoJson()),
          createdAt: { _seconds: oldDate.getTime() / 1000 },
          timespanEnd: { _seconds: oldDate.getTime() / 1000 }, // Falls back to createdAt
        }),
      },
    ];

    await setupFirebaseMock(mockMessages);

    const mockRequest = new Request("http://localhost/api/messages");
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(data.messages).toHaveLength(1);
    expect(data.messages[0].id).toBe("msg1");
  });

  it("should show message if at least one timespan is still relevant", async () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const mockMessages = [
      {
        id: "msg1",
        data: () => ({
          text: "Mixed timespans",
          extractedData: JSON.stringify({
            responsible_entity: "Test",
            pins: [
              {
                address: "ул. Тест 1",
                timespans: [
                  { start: formatDate(yesterday), end: formatDate(yesterday) }, // expired
                ],
              },
            ],
            streets: [
              {
                street: "ул. Тест",
                from: "кръстовище А",
                to: "кръстовище Б",
                timespans: [
                  { start: formatDate(yesterday), end: formatDate(tomorrow) }, // current
                ],
              },
            ],
          }),
          geoJson: JSON.stringify(createMockGeoJson()),
          createdAt: { _seconds: yesterday.getTime() / 1000 },
          timespanEnd: { _seconds: tomorrow.getTime() / 1000 }, // MAX end time
        }),
      },
    ];

    await setupFirebaseMock(mockMessages);

    const mockRequest = new Request("http://localhost/api/messages");
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(data.messages).toHaveLength(1);
    expect(data.messages[0].id).toBe("msg1");
  });

  it("should use default 7 days when MESSAGE_RELEVANCE_DAYS is not set", async () => {
    const date5DaysAgo = new Date();
    date5DaysAgo.setDate(date5DaysAgo.getDate() - 5);

    const mockMessages = [
      {
        id: "msg1",
        data: () => ({
          text: "Message from 5 days ago",
          geoJson: JSON.stringify(createMockGeoJson()),
          createdAt: { _seconds: date5DaysAgo.getTime() / 1000 },
          timespanEnd: { _seconds: date5DaysAgo.getTime() / 1000 },
        }),
      },
    ];

    await setupFirebaseMock(mockMessages);

    const mockRequest = new Request("http://localhost/api/messages");
    const response = await GET(mockRequest);
    const data = await response.json();

    // Should be included because it's within 7 days
    expect(data.messages).toHaveLength(1);
  });
});
