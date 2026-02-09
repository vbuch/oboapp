import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

// Mock the firebase-admin module
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

// Helper to create Firebase Timestamp
const createTimestamp = (date: Date) => ({
  _seconds: Math.floor(date.getTime() / 1000),
  _nanoseconds: 0,
  toDate: () => date,
});

describe("GET /api/messages/ingest-errors - Array Field Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should validate pins field as array and fallback to undefined for non-arrays", async () => {
    const { adminDb } = await import("@/lib/firebase-admin");

    const now = new Date();
    const mockMessages = [
      {
        id: "msg-1",
        data: () => ({
          text: "Test message 1",
          plainText: "Test message 1",
          finalizedAt: createTimestamp(now),
          createdAt: createTimestamp(now),
          source: "test-source",
          sourceUrl: "https://example.com",
          categories: [],
          pins: [{ latitude: 42.7, longitude: 23.3 }], // Valid array
        }),
      },
      {
        id: "msg-2",
        data: () => ({
          text: "Test message 2",
          plainText: "Test message 2",
          finalizedAt: createTimestamp(now),
          createdAt: createTimestamp(now),
          source: "test-source",
          sourceUrl: "https://example.com",
          categories: [],
          pins: "not-an-array", // Invalid: string
        }),
      },
      {
        id: "msg-3",
        data: () => ({
          text: "Test message 3",
          plainText: "Test message 3",
          finalizedAt: createTimestamp(now),
          createdAt: createTimestamp(now),
          source: "test-source",
          sourceUrl: "https://example.com",
          categories: [],
          pins: null, // Invalid: null
        }),
      },
    ];

    const mockSnapshot = {
      empty: false,
      size: 3,
      docs: mockMessages,
      forEach: vi.fn((callback) => {
        mockMessages.forEach((doc) => callback(doc));
      }),
    };

    const mockGet = vi.fn().mockResolvedValue(mockSnapshot);
    const mockLimit = { get: mockGet };
    const mockOrderBy2 = { limit: vi.fn().mockReturnValue(mockLimit) };
    const mockOrderBy1 = {
      orderBy: vi.fn().mockReturnValue(mockOrderBy2),
    };
    const mockWhere = { orderBy: vi.fn().mockReturnValue(mockOrderBy1) };
    const mockCollection = { where: vi.fn().mockReturnValue(mockWhere) };

    vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);

    const mockRequest = new Request(
      "http://localhost/api/messages/ingest-errors",
    );
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(3);

    // msg-1: Valid array should be preserved
    expect(data.messages[0].pins).toEqual([
      { latitude: 42.7, longitude: 23.3 },
    ]);

    // msg-2: String should become undefined
    expect(data.messages[1].pins).toBeUndefined();

    // msg-3: Null should become undefined
    expect(data.messages[2].pins).toBeUndefined();
  });

  it("should validate streets field as array and fallback to undefined for non-arrays", async () => {
    const { adminDb } = await import("@/lib/firebase-admin");

    const now = new Date();
    const mockMessages = [
      {
        id: "msg-1",
        data: () => ({
          text: "Test message 1",
          plainText: "Test message 1",
          finalizedAt: createTimestamp(now),
          createdAt: createTimestamp(now),
          source: "test-source",
          sourceUrl: "https://example.com",
          categories: [],
          streets: [{ name: "Test Street" }], // Valid array
        }),
      },
      {
        id: "msg-2",
        data: () => ({
          text: "Test message 2",
          plainText: "Test message 2",
          finalizedAt: createTimestamp(now),
          createdAt: createTimestamp(now),
          source: "test-source",
          sourceUrl: "https://example.com",
          categories: [],
          streets: { name: "Invalid Object" }, // Invalid: object
        }),
      },
    ];

    const mockSnapshot = {
      empty: false,
      size: 2,
      docs: mockMessages,
      forEach: vi.fn((callback) => {
        mockMessages.forEach((doc) => callback(doc));
      }),
    };

    const mockGet = vi.fn().mockResolvedValue(mockSnapshot);
    const mockLimit = { get: mockGet };
    const mockOrderBy2 = { limit: vi.fn().mockReturnValue(mockLimit) };
    const mockOrderBy1 = {
      orderBy: vi.fn().mockReturnValue(mockOrderBy2),
    };
    const mockWhere = { orderBy: vi.fn().mockReturnValue(mockOrderBy1) };
    const mockCollection = { where: vi.fn().mockReturnValue(mockWhere) };

    vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);

    const mockRequest = new Request(
      "http://localhost/api/messages/ingest-errors",
    );
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(2);

    // msg-1: Valid array should be preserved
    expect(data.messages[0].streets).toEqual([{ name: "Test Street" }]);

    // msg-2: Object should become undefined
    expect(data.messages[1].streets).toBeUndefined();
  });

  it("should validate cadastralProperties field as array and fallback to undefined for non-arrays", async () => {
    const { adminDb } = await import("@/lib/firebase-admin");

    const now = new Date();
    const mockMessages = [
      {
        id: "msg-1",
        data: () => ({
          text: "Test message 1",
          plainText: "Test message 1",
          finalizedAt: createTimestamp(now),
          createdAt: createTimestamp(now),
          source: "test-source",
          sourceUrl: "https://example.com",
          categories: [],
          cadastralProperties: [{ identifier: "УПИ-123" }], // Valid array
        }),
      },
      {
        id: "msg-2",
        data: () => ({
          text: "Test message 2",
          plainText: "Test message 2",
          finalizedAt: createTimestamp(now),
          createdAt: createTimestamp(now),
          source: "test-source",
          sourceUrl: "https://example.com",
          categories: [],
          cadastralProperties: 123, // Invalid: number
        }),
      },
    ];

    const mockSnapshot = {
      empty: false,
      size: 2,
      docs: mockMessages,
      forEach: vi.fn((callback) => {
        mockMessages.forEach((doc) => callback(doc));
      }),
    };

    const mockGet = vi.fn().mockResolvedValue(mockSnapshot);
    const mockLimit = { get: mockGet };
    const mockOrderBy2 = { limit: vi.fn().mockReturnValue(mockLimit) };
    const mockOrderBy1 = {
      orderBy: vi.fn().mockReturnValue(mockOrderBy2),
    };
    const mockWhere = { orderBy: vi.fn().mockReturnValue(mockOrderBy1) };
    const mockCollection = { where: vi.fn().mockReturnValue(mockWhere) };

    vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);

    const mockRequest = new Request(
      "http://localhost/api/messages/ingest-errors",
    );
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(2);

    // msg-1: Valid array should be preserved
    expect(data.messages[0].cadastralProperties).toEqual([
      { identifier: "УПИ-123" },
    ]);

    // msg-2: Number should become undefined
    expect(data.messages[1].cadastralProperties).toBeUndefined();
  });

  it("should validate busStops field as array and fallback to undefined for non-arrays", async () => {
    const { adminDb } = await import("@/lib/firebase-admin");

    const now = new Date();
    const mockMessages = [
      {
        id: "msg-1",
        data: () => ({
          text: "Test message 1",
          plainText: "Test message 1",
          finalizedAt: createTimestamp(now),
          createdAt: createTimestamp(now),
          source: "test-source",
          sourceUrl: "https://example.com",
          categories: [],
          busStops: [{ name: "Stop 1" }], // Valid array
        }),
      },
      {
        id: "msg-2",
        data: () => ({
          text: "Test message 2",
          plainText: "Test message 2",
          finalizedAt: createTimestamp(now),
          createdAt: createTimestamp(now),
          source: "test-source",
          sourceUrl: "https://example.com",
          categories: [],
          busStops: undefined, // Invalid: undefined
        }),
      },
    ];

    const mockSnapshot = {
      empty: false,
      size: 2,
      docs: mockMessages,
      forEach: vi.fn((callback) => {
        mockMessages.forEach((doc) => callback(doc));
      }),
    };

    const mockGet = vi.fn().mockResolvedValue(mockSnapshot);
    const mockLimit = { get: mockGet };
    const mockOrderBy2 = { limit: vi.fn().mockReturnValue(mockLimit) };
    const mockOrderBy1 = {
      orderBy: vi.fn().mockReturnValue(mockOrderBy2),
    };
    const mockWhere = { orderBy: vi.fn().mockReturnValue(mockOrderBy1) };
    const mockCollection = { where: vi.fn().mockReturnValue(mockWhere) };

    vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);

    const mockRequest = new Request(
      "http://localhost/api/messages/ingest-errors",
    );
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(2);

    // msg-1: Valid array should be preserved
    expect(data.messages[0].busStops).toEqual([{ name: "Stop 1" }]);

    // msg-2: Undefined should remain undefined
    expect(data.messages[1].busStops).toBeUndefined();
  });

  it("should handle messages with missing geoJson and no location fields", async () => {
    const { adminDb } = await import("@/lib/firebase-admin");

    const now = new Date();
    const mockMessages = [
      {
        id: "msg-1",
        data: () => ({
          text: "Test message without geoJson",
          plainText: "Test message without geoJson",
          finalizedAt: createTimestamp(now),
          createdAt: createTimestamp(now),
          source: "test-source",
          sourceUrl: "https://example.com",
          categories: [],
          // No geoJson, no location fields
        }),
      },
    ];

    const mockSnapshot = {
      empty: false,
      size: 1,
      docs: mockMessages,
      forEach: vi.fn((callback) => {
        mockMessages.forEach((doc) => callback(doc));
      }),
    };

    const mockGet = vi.fn().mockResolvedValue(mockSnapshot);
    const mockLimit = { get: mockGet };
    const mockOrderBy2 = { limit: vi.fn().mockReturnValue(mockLimit) };
    const mockOrderBy1 = {
      orderBy: vi.fn().mockReturnValue(mockOrderBy2),
    };
    const mockWhere = { orderBy: vi.fn().mockReturnValue(mockOrderBy1) };
    const mockCollection = { where: vi.fn().mockReturnValue(mockWhere) };

    vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);

    const mockRequest = new Request(
      "http://localhost/api/messages/ingest-errors",
    );
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(1);

    // All location fields should be undefined
    expect(data.messages[0].pins).toBeUndefined();
    expect(data.messages[0].streets).toBeUndefined();
    expect(data.messages[0].cadastralProperties).toBeUndefined();
    expect(data.messages[0].busStops).toBeUndefined();
  });

  it("should preserve all location fields when they are valid arrays", async () => {
    const { adminDb } = await import("@/lib/firebase-admin");

    const now = new Date();
    const mockMessages = [
      {
        id: "msg-1",
        data: () => ({
          text: "Test message with all location fields",
          plainText: "Test message with all location fields",
          finalizedAt: createTimestamp(now),
          createdAt: createTimestamp(now),
          source: "test-source",
          sourceUrl: "https://example.com",
          categories: [],
          pins: [{ latitude: 42.7, longitude: 23.3 }],
          streets: [{ name: "Test Street" }],
          cadastralProperties: [{ identifier: "УПИ-123" }],
          busStops: [{ name: "Stop 1" }],
        }),
      },
    ];

    const mockSnapshot = {
      empty: false,
      size: 1,
      docs: mockMessages,
      forEach: vi.fn((callback) => {
        mockMessages.forEach((doc) => callback(doc));
      }),
    };

    const mockGet = vi.fn().mockResolvedValue(mockSnapshot);
    const mockLimit = { get: mockGet };
    const mockOrderBy2 = { limit: vi.fn().mockReturnValue(mockLimit) };
    const mockOrderBy1 = {
      orderBy: vi.fn().mockReturnValue(mockOrderBy2),
    };
    const mockWhere = { orderBy: vi.fn().mockReturnValue(mockOrderBy1) };
    const mockCollection = { where: vi.fn().mockReturnValue(mockWhere) };

    vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);

    const mockRequest = new Request(
      "http://localhost/api/messages/ingest-errors",
    );
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(1);

    // All location fields should be preserved
    expect(data.messages[0].pins).toEqual([
      { latitude: 42.7, longitude: 23.3 },
    ]);
    expect(data.messages[0].streets).toEqual([{ name: "Test Street" }]);
    expect(data.messages[0].cadastralProperties).toEqual([
      { identifier: "УПИ-123" },
    ]);
    expect(data.messages[0].busStops).toEqual([{ name: "Stop 1" }]);
  });
});
