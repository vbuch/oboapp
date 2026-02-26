import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const { findByUserIdMock, findManyMock } = vi.hoisted(() => ({
  findByUserIdMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn().mockResolvedValue({
    interests: {
      findByUserId: findByUserIdMock,
      findMany: findManyMock,
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

  it("skips malformed records and returns valid interests", async () => {
    findByUserIdMock.mockResolvedValue([
      {
        _id: "interest-1",
        userId: "user-1",
        coordinates: { lat: 42.7, lng: 23.3 },
        radius: 500,
        createdAt: 123,
        updatedAt: new Date(),
      },
      {
        _id: "interest-2",
        userId: "user-1",
        coordinates: { lat: 42.71, lng: 23.31 },
        radius: 300,
        createdAt: new Date("2026-02-15T10:00:00.000Z"),
        updatedAt: new Date("2026-02-15T10:00:00.000Z"),
      },
    ]);

    const request = new Request("http://localhost/api/interests", {
      headers: { authorization: "Bearer test-token" },
    });

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data.interests)).toBe(true);
    expect(data.interests).toHaveLength(1);
    expect(data.interests[0]).toMatchObject({
      id: "interest-2",
      userId: "user-1",
      radius: 300,
      coordinates: { lat: 42.71, lng: 23.31 },
    });
  });

  it("falls back to userId-only query when indexed query fails", async () => {
    findByUserIdMock.mockRejectedValueOnce(new Error("index missing"));
    findManyMock.mockResolvedValueOnce([
      {
        _id: "interest-fallback-1",
        userId: "user-1",
        coordinates: { lat: 42.72, lng: 23.32 },
        radius: 450,
        createdAt: new Date("2026-02-16T10:00:00.000Z"),
        updatedAt: new Date("2026-02-16T10:00:00.000Z"),
      },
    ]);

    const request = new Request("http://localhost/api/interests", {
      headers: { authorization: "Bearer test-token" },
    });

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(findByUserIdMock).toHaveBeenCalledTimes(1);
    expect(findManyMock).toHaveBeenCalledWith({
      where: [{ field: "userId", op: "==", value: "user-1" }],
    });
    expect(data.interests).toHaveLength(1);
    expect(data.interests[0]).toMatchObject({
      id: "interest-fallback-1",
      userId: "user-1",
      radius: 450,
      coordinates: { lat: 42.72, lng: 23.32 },
    });
  });
});
