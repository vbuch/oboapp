import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const { findByUserIdMock } = vi.hoisted(() => ({
  findByUserIdMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn().mockResolvedValue({
    interests: {
      findByUserId: findByUserIdMock,
    },
  }),
}));

vi.mock("@/lib/verifyAuthToken", () => ({
  verifyAuthToken: vi.fn().mockResolvedValue({ userId: "user-1" }),
}));

describe("GET /api/interests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 500 when createdAt/updatedAt are invalid instead of fabricating current time", async () => {
    findByUserIdMock.mockResolvedValue([
      {
        _id: "interest-1",
        userId: "user-1",
        coordinates: { lat: 42.7, lng: 23.3 },
        radius: 500,
        createdAt: 123,
        updatedAt: new Date(),
      },
    ]);

    const request = new Request("http://localhost/api/interests", {
      headers: { authorization: "Bearer test-token" },
    });

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch interests");
  });
});
