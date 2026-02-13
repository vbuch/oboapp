import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";

// Track calls for assertions
const countMock = vi.fn().mockResolvedValue(0);

vi.mock("@/lib/db", () => ({
  getDb: vi.fn().mockImplementation(async () => ({
    notificationMatches: {
      count: countMock,
    },
  })),
}));

vi.mock("@/lib/verifyAuthToken", () => ({
  verifyAuthToken: vi.fn().mockResolvedValue({
    userId: "user-123",
    userEmail: "test@example.com",
  }),
}));

function createRequest(): Request {
  return new Request("http://localhost:3000/api/notifications/history/count", {
    method: "GET",
    headers: {
      authorization: "Bearer test-token",
    },
  });
}

describe("GET /api/notifications/history/count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns notification count for the user", async () => {
    countMock.mockResolvedValue(5);

    const response = await GET(createRequest() as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ count: 5 });
    expect(countMock).toHaveBeenCalledWith([
      { field: "userId", op: "==", value: "user-123" },
      { field: "notified", op: "==", value: true },
    ]);
  });

  it("returns 0 when user has no notifications", async () => {
    countMock.mockResolvedValue(0);

    const response = await GET(createRequest() as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ count: 0 });
  });

  it("returns 500 on database error", async () => {
    countMock.mockRejectedValue(new Error("DB connection failed"));

    const response = await GET(createRequest() as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Failed to fetch notification count" });
  });
});
