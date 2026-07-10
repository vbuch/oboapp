import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, POST } from "../route";

const {
  hasSubscriptionMock,
  findByUserAndTokenMock,
  updateOneMock,
  findByIdMock,
  insertOneMock,
  deleteOneMock,
} = vi.hoisted(() => ({
  hasSubscriptionMock: vi.fn(),
  findByUserAndTokenMock: vi.fn(),
  updateOneMock: vi.fn(),
  findByIdMock: vi.fn(),
  insertOneMock: vi.fn(),
  deleteOneMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn().mockResolvedValue({
    notificationSubscriptions: {
      hasSubscription: hasSubscriptionMock,
      findByUserAndToken: findByUserAndTokenMock,
      updateOne: updateOneMock,
      findById: findByIdMock,
      insertOne: insertOneMock,
      deleteOne: deleteOneMock,
    },
  }),
}));

vi.mock("@/lib/verifyAuthToken", () => ({
  verifyAuthToken: vi.fn().mockResolvedValue({ userId: "user-123" }),
}));

function makeRequest(
  url: string,
  method: string,
  body?: Record<string, unknown>,
): Request {
  return new Request(url, {
    method,
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("/api/notifications/subscription route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns hasSubscription flag", async () => {
    hasSubscriptionMock.mockResolvedValueOnce(true);

    const response = await GET(
      makeRequest(
        "http://localhost/api/notifications/subscription",
        "GET",
      ) as any,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ hasSubscription: true });
    expect(hasSubscriptionMock).toHaveBeenCalledWith("user-123");
  });

  it("POST returns 400 when token or endpoint is missing", async () => {
    const response = await POST(
      makeRequest("http://localhost/api/notifications/subscription", "POST", {
        token: "",
        endpoint: "",
      }) as any,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Token and endpoint are required",
    });
  });

  it("POST creates new subscription and sanitizes deviceInfo fields", async () => {
    findByUserAndTokenMock.mockResolvedValueOnce(null);
    insertOneMock.mockResolvedValueOnce("sub-1");

    const response = await POST(
      makeRequest("http://localhost/api/notifications/subscription", "POST", {
        token: "token-1",
        endpoint: "https://push.example.com",
        deviceInfo: {
          userAgent: "agent",
          platform: "ios",
          ignored: "x",
        },
      }) as any,
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({
      id: "sub-1",
      userId: "user-123",
      token: "token-1",
      endpoint: "https://push.example.com",
      deviceInfo: { userAgent: "agent", platform: "ios" },
    });

    expect(insertOneMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        token: "token-1",
        endpoint: "https://push.example.com",
        deviceInfo: { userAgent: "agent", platform: "ios" },
      }),
    );
  });

  it("POST updates existing subscription and maps stored record", async () => {
    findByUserAndTokenMock.mockResolvedValueOnce({ _id: "sub-1" });
    updateOneMock.mockResolvedValueOnce(undefined);
    findByIdMock.mockResolvedValueOnce({
      _id: "sub-1",
      userId: "user-123",
      token: "token-1",
      endpoint: "https://push.example.com",
      createdAt: "2026-07-10T10:00:00.000Z",
      updatedAt: "2026-07-10T11:00:00.000Z",
      deviceInfo: { userAgent: "ua" },
    });

    const response = await POST(
      makeRequest("http://localhost/api/notifications/subscription", "POST", {
        token: "token-1",
        endpoint: "https://push.example.com",
        deviceInfo: { userAgent: "ua", platform: 123 },
      }) as any,
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({
      id: "sub-1",
      token: "token-1",
      endpoint: "https://push.example.com",
      deviceInfo: { userAgent: "ua" },
    });
    expect(updateOneMock).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({
        deviceInfo: { userAgent: "ua", platform: undefined },
      }),
    );
  });

  it("DELETE removes existing subscription by token", async () => {
    findByUserAndTokenMock.mockResolvedValueOnce({ _id: "sub-1" });

    const response = await DELETE(
      makeRequest(
        "http://localhost/api/notifications/subscription?token=token-1",
        "DELETE",
      ) as any,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(deleteOneMock).toHaveBeenCalledWith("sub-1");
  });
});
