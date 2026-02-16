import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, DELETE } from "../route";

// Mock data store
let mockSubscriptionsData: Record<string, unknown>[] = [];

// Track calls for assertions
const findByUserIdMock = vi
  .fn()
  .mockImplementation(async () => [...mockSubscriptionsData]);
const deleteAllByUserIdMock = vi.fn().mockResolvedValue(0);

vi.mock("@/lib/db", () => ({
  getDb: vi.fn().mockImplementation(async () => ({
    notificationSubscriptions: {
      findByUserId: findByUserIdMock,
      deleteAllByUserId: deleteAllByUserIdMock,
    },
  })),
}));

vi.mock("@/lib/verifyAuthToken", () => ({
  verifyAuthToken: vi.fn().mockResolvedValue({
    userId: "user-123",
    userEmail: "test@example.com",
  }),
}));

function createRequest(
  method: string,
  headers: Record<string, string> = {},
): Request {
  return new Request(
    "http://localhost:3000/api/notifications/subscription/all",
    {
      method,
      headers: {
        authorization: "Bearer test-token",
        ...headers,
      },
    },
  );
}

describe("GET /api/notifications/subscription/all", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscriptionsData = [];
  });

  it("returns all subscriptions for the user sorted by createdAt descending", async () => {
    mockSubscriptionsData = [
      {
        _id: "sub-1",
        userId: "user-123",
        token: "token-1",
        endpoint: "https://push.example.com/1",
        createdAt: new Date("2025-01-01T00:00:00Z"),
        updatedAt: new Date("2025-01-01T00:00:00Z"),
        deviceInfo: { platform: "chrome" },
      },
      {
        _id: "sub-2",
        userId: "user-123",
        token: "token-2",
        endpoint: "https://push.example.com/2",
        createdAt: new Date("2025-02-01T00:00:00Z"),
        updatedAt: new Date("2025-02-01T00:00:00Z"),
        deviceInfo: { platform: "firefox" },
      },
    ];

    const response = await GET(createRequest("GET") as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    // Newest first
    expect(data[0].id).toBe("sub-2");
    expect(data[1].id).toBe("sub-1");
    expect(data[0].token).toBe("token-2");
    expect(data[0].endpoint).toBe("https://push.example.com/2");
    expect(data[0].deviceInfo).toEqual({ platform: "firefox" });
    expect(findByUserIdMock).toHaveBeenCalledWith("user-123");
  });

  it("returns empty array when user has no subscriptions", async () => {
    mockSubscriptionsData = [];

    const response = await GET(createRequest("GET") as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
  });

  it("converts Date objects to ISO strings", async () => {
    mockSubscriptionsData = [
      {
        _id: "sub-1",
        userId: "user-123",
        token: "token-1",
        endpoint: "https://push.example.com/1",
        createdAt: new Date("2025-06-15T12:00:00Z"),
        updatedAt: new Date("2025-06-15T13:00:00Z"),
        deviceInfo: {},
      },
    ];

    const response = await GET(createRequest("GET") as any);
    const data = await response.json();

    expect(data[0].createdAt).toBe("2025-06-15T12:00:00.000Z");
    expect(data[0].updatedAt).toBe("2025-06-15T13:00:00.000Z");
  });

  it("handles string timestamps from records", async () => {
    mockSubscriptionsData = [
      {
        _id: "sub-1",
        userId: "user-123",
        token: "token-1",
        endpoint: "https://push.example.com/1",
        createdAt: "2025-06-15T12:00:00Z",
        updatedAt: "2025-06-15T13:00:00Z",
      },
    ];

    const response = await GET(createRequest("GET") as any);
    const data = await response.json();

    expect(data[0].createdAt).toBe("2025-06-15T12:00:00Z");
    expect(data[0].deviceInfo).toEqual({});
  });
});

describe("DELETE /api/notifications/subscription/all", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscriptionsData = [];
  });

  it("deletes all subscriptions for the user and returns count", async () => {
    mockSubscriptionsData = [
      { _id: "sub-1", userId: "user-123", token: "t1", endpoint: "e1" },
      { _id: "sub-2", userId: "user-123", token: "t2", endpoint: "e2" },
      { _id: "sub-3", userId: "user-123", token: "t3", endpoint: "e3" },
    ];
    deleteAllByUserIdMock.mockResolvedValueOnce(3);

    const response = await DELETE(createRequest("DELETE") as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, deleted: 3 });
    expect(deleteAllByUserIdMock).toHaveBeenCalledWith("user-123");
  });

  it("returns deleted: 0 when user has no subscriptions", async () => {
    mockSubscriptionsData = [];
    deleteAllByUserIdMock.mockResolvedValueOnce(0);

    const response = await DELETE(createRequest("DELETE") as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, deleted: 0 });
  });
});
