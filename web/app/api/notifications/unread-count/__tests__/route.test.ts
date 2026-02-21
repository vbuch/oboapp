import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";

const { countMock } = vi.hoisted(() => ({
  countMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn().mockResolvedValue({
    notificationMatches: {
      count: countMock,
    },
  }),
}));

const { verifyAuthTokenMock } = vi.hoisted(() => ({
  verifyAuthTokenMock: vi.fn(),
}));

vi.mock("@/lib/verifyAuthToken", () => ({
  verifyAuthToken: verifyAuthTokenMock,
}));

describe("GET /api/notifications/unread-count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAuthTokenMock.mockResolvedValue({ userId: "user-1" });
  });

  it("returns unread count for authenticated user", async () => {
    countMock.mockResolvedValue(5);

    const request = new Request("http://localhost/api/notifications/unread-count", {
      headers: { authorization: "Bearer test-token" },
    });

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ count: 5 });
    expect(countMock).toHaveBeenCalledWith([
      { field: "userId", op: "==", value: "user-1" },
      { field: "notified", op: "==", value: true },
      { field: "readAt", op: "==", value: null },
    ]);
  });

  it("returns 0 when no unread notifications", async () => {
    countMock.mockResolvedValue(0);

    const request = new Request("http://localhost/api/notifications/unread-count", {
      headers: { authorization: "Bearer test-token" },
    });

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ count: 0 });
  });

  it("returns 401 when authentication fails", async () => {
    verifyAuthTokenMock.mockRejectedValue(new Error("Missing auth token"));

    const request = new Request("http://localhost/api/notifications/unread-count", {
      headers: { authorization: "Bearer invalid-token" },
    });

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain("Unauthorized");
  });

  it("returns 500 when database fails", async () => {
    countMock.mockRejectedValue(new Error("DB connection failed"));

    const request = new Request("http://localhost/api/notifications/unread-count", {
      headers: { authorization: "Bearer test-token" },
    });

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch unread notification count");
  });
});
