import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, PATCH } from "./route";
import { DEFAULT_ZONE_COLOR } from "@/lib/zoneTypes";

const {
  findByUserIdMock,
  findManyMock,
  insertOneMock,
  findByIdMock,
  updateOneMock,
} = vi.hoisted(() => ({
  findByUserIdMock: vi.fn(),
  findManyMock: vi.fn(),
  insertOneMock: vi.fn(),
  findByIdMock: vi.fn(),
  updateOneMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn().mockResolvedValue({
    interests: {
      findByUserId: findByUserIdMock,
      findMany: findManyMock,
      insertOne: insertOneMock,
      findById: findByIdMock,
      updateOne: updateOneMock,
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

describe("POST /api/interests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sanitizes label and keeps only supported color", async () => {
    insertOneMock.mockResolvedValue("interest-created");

    const request = new Request("http://localhost/api/interests", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        coordinates: { lat: 42.7, lng: 23.3 },
        radius: 500,
        label: "  Моя    зона  ",
        color: DEFAULT_ZONE_COLOR,
      }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(insertOneMock).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Моя зона",
        color: DEFAULT_ZONE_COLOR,
      }),
    );
    expect(data.interest).toMatchObject({
      id: "interest-created",
      label: "Моя зона",
      color: DEFAULT_ZONE_COLOR,
    });
  });

  it("drops unsupported color and empty label", async () => {
    insertOneMock.mockResolvedValue("interest-created");

    const request = new Request("http://localhost/api/interests", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        coordinates: { lat: 42.7, lng: 23.3 },
        radius: 500,
        label: "   ",
        color: "#123456",
      }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(insertOneMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ label: expect.anything() }),
    );
    expect(insertOneMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ color: expect.anything() }),
    );
    expect(data.interest.label).toBeUndefined();
    expect(data.interest.color).toBeUndefined();
  });
});

describe("PATCH /api/interests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates label as sanitized value and ignores unsupported color", async () => {
    findByIdMock
      .mockResolvedValueOnce({
        _id: "interest-1",
        userId: "user-1",
        coordinates: { lat: 42.7, lng: 23.3 },
        radius: 500,
        createdAt: new Date("2026-02-16T10:00:00.000Z"),
        updatedAt: new Date("2026-02-16T10:00:00.000Z"),
      })
      .mockResolvedValueOnce({
        _id: "interest-1",
        userId: "user-1",
        coordinates: { lat: 42.7, lng: 23.3 },
        radius: 500,
        label: "Работа",
        color: DEFAULT_ZONE_COLOR,
        createdAt: new Date("2026-02-16T10:00:00.000Z"),
        updatedAt: new Date("2026-02-16T11:00:00.000Z"),
      });

    const request = new Request("http://localhost/api/interests", {
      method: "PATCH",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        id: "interest-1",
        label: "  Работа  ",
        color: "#123456",
      }),
    });

    const response = await PATCH(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(updateOneMock).toHaveBeenCalledWith(
      "interest-1",
      expect.objectContaining({
        label: "Работа",
      }),
    );
    expect(updateOneMock).toHaveBeenCalledWith(
      "interest-1",
      expect.not.objectContaining({ color: expect.anything() }),
    );
    expect(data.interest).toMatchObject({
      id: "interest-1",
      label: "Работа",
      color: DEFAULT_ZONE_COLOR,
    });
  });
});
