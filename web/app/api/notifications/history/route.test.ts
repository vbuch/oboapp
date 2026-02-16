import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const { findByUserIdMock } = vi.hoisted(() => ({
  findByUserIdMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn().mockResolvedValue({
    notificationMatches: {
      findByUserId: findByUserIdMock,
    },
  }),
}));

vi.mock("@/lib/verifyAuthToken", () => ({
  verifyAuthToken: vi.fn().mockResolvedValue({ userId: "user-1" }),
}));

describe("GET /api/notifications/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 500 when notifiedAt is invalid instead of fabricating current time", async () => {
    findByUserIdMock.mockResolvedValue([
      {
        _id: "match-1",
        messageId: "msg-1",
        notifiedAt: 123,
        distance: 50,
        interestId: "interest-1",
        deviceNotifications: [],
      },
    ]);

    const request = new Request("http://localhost/api/notifications/history", {
      headers: { authorization: "Bearer test-token" },
    });

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch notification history");
  });
});
