import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

// Mock data store — tests set this before each test
let mockMessagesData: Record<string, unknown>[] = [];

// Mock the db module (replaces the old firebase-admin mock)
vi.mock("@/lib/db", () => ({
  getDb: vi.fn().mockImplementation(async () => ({
    messages: {
      findMany: vi.fn().mockImplementation(async (options?: any) => {
        let filtered = [...mockMessagesData];

        if (options?.where) {
          for (const clause of options.where) {
            filtered = filtered.filter((doc) => {
              const fieldValue = doc[clause.field];

              switch (clause.op) {
                case ">":
                  if (fieldValue == null) return false;
                  return fieldValue > clause.value;
                case "<":
                  if (fieldValue == null) return false;
                  return fieldValue < clause.value;
                case ">=":
                  if (fieldValue == null) return false;
                  return fieldValue >= clause.value;
                case "<=":
                  if (fieldValue == null) return false;
                  return fieldValue <= clause.value;
                case "==":
                  return fieldValue === clause.value;
                default:
                  return true;
              }
            });
          }
        }

        if (options?.limit) {
          filtered = filtered.slice(0, options.limit);
        }

        return filtered;
      }),
    },
  })),
}));

describe("GET /api/messages/ingest-errors - Array Field Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMessagesData = [];
  });

  it("should validate pins field as array and fallback to undefined for non-arrays", async () => {
    const now = new Date();

    mockMessagesData = [
      {
        _id: "msg-1",
        text: "Test message 1",
        plainText: "Test message 1",
        finalizedAt: now,
        createdAt: now,
        source: "test-source",
        sourceUrl: "https://example.com",
        categories: [],
        pins: [{ latitude: 42.7, longitude: 23.3 }], // Valid array
      },
      {
        _id: "msg-2",
        text: "Test message 2",
        plainText: "Test message 2",
        finalizedAt: now,
        createdAt: now,
        source: "test-source",
        sourceUrl: "https://example.com",
        categories: [],
        pins: "not-an-array", // Invalid: string
      },
      {
        _id: "msg-3",
        text: "Test message 3",
        plainText: "Test message 3",
        finalizedAt: now,
        createdAt: now,
        source: "test-source",
        sourceUrl: "https://example.com",
        categories: [],
        pins: null, // Invalid: null
      },
    ];

    const mockRequest = new Request(
      "http://localhost/api/messages/ingest-errors",
    );
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(3);

    const msg1 = data.messages.find((message: { id: string }) => message.id === "msg-1");
    const msg2 = data.messages.find((message: { id: string }) => message.id === "msg-2");
    const msg3 = data.messages.find((message: { id: string }) => message.id === "msg-3");

    // msg-1: Valid array should be preserved
    expect(msg1?.pins).toEqual([
      { latitude: 42.7, longitude: 23.3 },
    ]);

    // msg-2: String should become undefined
    expect(msg2?.pins).toBeUndefined();

    // msg-3: Null should become undefined
    expect(msg3?.pins).toBeUndefined();
  });

  it("should validate streets field as array and fallback to undefined for non-arrays", async () => {
    const now = new Date();

    mockMessagesData = [
      {
        _id: "msg-1",
        text: "Test message 1",
        plainText: "Test message 1",
        finalizedAt: now,
        createdAt: now,
        source: "test-source",
        sourceUrl: "https://example.com",
        categories: [],
        streets: [{ name: "Test Street" }], // Valid array
      },
      {
        _id: "msg-2",
        text: "Test message 2",
        plainText: "Test message 2",
        finalizedAt: now,
        createdAt: now,
        source: "test-source",
        sourceUrl: "https://example.com",
        categories: [],
        streets: { name: "Invalid Object" }, // Invalid: object
      },
    ];

    const mockRequest = new Request(
      "http://localhost/api/messages/ingest-errors",
    );
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(2);

    const msg1 = data.messages.find((message: { id: string }) => message.id === "msg-1");
    const msg2 = data.messages.find((message: { id: string }) => message.id === "msg-2");

    // msg-1: Valid array should be preserved
    expect(msg1?.streets).toEqual([{ name: "Test Street" }]);

    // msg-2: Object should become undefined
    expect(msg2?.streets).toBeUndefined();
  });

  it("should validate cadastralProperties field as array and fallback to undefined for non-arrays", async () => {
    const now = new Date();

    mockMessagesData = [
      {
        _id: "msg-1",
        text: "Test message 1",
        plainText: "Test message 1",
        finalizedAt: now,
        createdAt: now,
        source: "test-source",
        sourceUrl: "https://example.com",
        categories: [],
        cadastralProperties: [{ identifier: "УПИ-123" }], // Valid array
      },
      {
        _id: "msg-2",
        text: "Test message 2",
        plainText: "Test message 2",
        finalizedAt: now,
        createdAt: now,
        source: "test-source",
        sourceUrl: "https://example.com",
        categories: [],
        cadastralProperties: 123, // Invalid: number
      },
    ];

    const mockRequest = new Request(
      "http://localhost/api/messages/ingest-errors",
    );
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(2);

    const msg1 = data.messages.find((message: { id: string }) => message.id === "msg-1");
    const msg2 = data.messages.find((message: { id: string }) => message.id === "msg-2");

    // msg-1: Valid array should be preserved
    expect(msg1?.cadastralProperties).toEqual([
      { identifier: "УПИ-123" },
    ]);

    // msg-2: Number should become undefined
    expect(msg2?.cadastralProperties).toBeUndefined();
  });

  it("should validate busStops field as array and fallback to undefined for non-arrays", async () => {
    const now = new Date();

    mockMessagesData = [
      {
        _id: "msg-1",
        text: "Test message 1",
        plainText: "Test message 1",
        finalizedAt: now,
        createdAt: now,
        source: "test-source",
        sourceUrl: "https://example.com",
        categories: [],
        busStops: [{ name: "Stop 1" }], // Valid array
      },
      {
        _id: "msg-2",
        text: "Test message 2",
        plainText: "Test message 2",
        finalizedAt: now,
        createdAt: now,
        source: "test-source",
        sourceUrl: "https://example.com",
        categories: [],
        busStops: undefined, // Invalid: undefined
      },
    ];

    const mockRequest = new Request(
      "http://localhost/api/messages/ingest-errors",
    );
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(2);

    const msg1 = data.messages.find((message: { id: string }) => message.id === "msg-1");
    const msg2 = data.messages.find((message: { id: string }) => message.id === "msg-2");

    // msg-1: Valid array should be preserved
    expect(msg1?.busStops).toEqual([{ name: "Stop 1" }]);

    // msg-2: Undefined should remain undefined
    expect(msg2?.busStops).toBeUndefined();
  });

  it("should handle messages with missing geoJson and no location fields", async () => {
    const now = new Date();

    mockMessagesData = [
      {
        _id: "msg-1",
        text: "Test message without geoJson",
        plainText: "Test message without geoJson",
        finalizedAt: now,
        createdAt: now,
        source: "test-source",
        sourceUrl: "https://example.com",
        categories: [],
        // No geoJson, no location fields
      },
    ];

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
    const now = new Date();

    mockMessagesData = [
      {
        _id: "msg-1",
        text: "Test message with all location fields",
        plainText: "Test message with all location fields",
        finalizedAt: now,
        createdAt: now,
        source: "test-source",
        sourceUrl: "https://example.com",
        categories: [],
        pins: [{ latitude: 42.7, longitude: 23.3 }],
        streets: [{ name: "Test Street" }],
        cadastralProperties: [{ identifier: "УПИ-123" }],
        busStops: [{ name: "Stop 1" }],
      },
    ];

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

  it("should include same-timestamp docs when cursorId is not provided", async () => {
    const boundaryDate = new Date("2026-01-10T10:00:00.000Z");
    const olderDate = new Date("2026-01-09T10:00:00.000Z");

    mockMessagesData = [
      {
        _id: "msg-1",
        text: "Boundary A",
        plainText: "Boundary A",
        finalizedAt: boundaryDate,
        createdAt: boundaryDate,
        source: "test-source",
        categories: [],
      },
      {
        _id: "msg-2",
        text: "Boundary B",
        plainText: "Boundary B",
        finalizedAt: boundaryDate,
        createdAt: boundaryDate,
        source: "test-source",
        categories: [],
      },
      {
        _id: "msg-3",
        text: "Older",
        plainText: "Older",
        finalizedAt: olderDate,
        createdAt: olderDate,
        source: "test-source",
        categories: [],
      },
    ];

    const request = new Request(
      "http://localhost/api/messages/ingest-errors?cursorFinalizedAt=2026-01-10T10:00:00.000Z",
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(3);
  });

  it("should use cursorId as tie-breaker for same finalizedAt", async () => {
    const boundaryDate = new Date("2026-01-10T10:00:00.000Z");
    const olderDate = new Date("2026-01-09T10:00:00.000Z");

    mockMessagesData = [
      {
        _id: "msg-c",
        text: "Boundary C",
        plainText: "Boundary C",
        finalizedAt: boundaryDate,
        createdAt: boundaryDate,
        source: "test-source",
        categories: [],
      },
      {
        _id: "msg-b",
        text: "Boundary B",
        plainText: "Boundary B",
        finalizedAt: boundaryDate,
        createdAt: boundaryDate,
        source: "test-source",
        categories: [],
      },
      {
        _id: "msg-a",
        text: "Boundary A",
        plainText: "Boundary A",
        finalizedAt: boundaryDate,
        createdAt: boundaryDate,
        source: "test-source",
        categories: [],
      },
      {
        _id: "msg-older",
        text: "Older",
        plainText: "Older",
        finalizedAt: olderDate,
        createdAt: olderDate,
        source: "test-source",
        categories: [],
      },
    ];

    const request = new Request(
      "http://localhost/api/messages/ingest-errors?cursorFinalizedAt=2026-01-10T10:00:00.000Z&cursorId=msg-b",
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages.map((m: { id: string }) => m.id)).toEqual([
      "msg-a",
      "msg-older",
    ]);
  });

  it("should paginate correctly when many docs share the same finalizedAt", async () => {
    const boundaryDate = new Date("2026-01-10T10:00:00.000Z");

    mockMessagesData = Array.from({ length: 60 }, (_, index) => ({
      _id: `msg-${String(index).padStart(3, "0")}`,
      text: `Boundary ${index}`,
      plainText: `Boundary ${index}`,
      finalizedAt: boundaryDate,
      createdAt: boundaryDate,
      source: "test-source",
      categories: [],
    }));

    const request = new Request(
      "http://localhost/api/messages/ingest-errors?cursorFinalizedAt=2026-01-10T10:00:00.000Z&cursorId=msg-040",
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(12);
    expect(data.messages[0].id).toBe("msg-039");
    expect(data.messages[11].id).toBe("msg-028");
    expect(data.nextCursor).toEqual({
      finalizedAt: "2026-01-10T10:00:00.000Z",
      id: "msg-028",
    });
  });
});
