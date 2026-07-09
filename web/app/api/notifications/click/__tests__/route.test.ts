import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";

const { findByIdMock, updateOneMock } = vi.hoisted(() => ({
  findByIdMock: vi.fn(),
  updateOneMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn().mockResolvedValue({
    notificationMatches: {
      findById: findByIdMock,
      updateOne: updateOneMock,
    },
  }),
}));

const { verifyAuthTokenMock } = vi.hoisted(() => ({
  verifyAuthTokenMock: vi.fn(),
}));

vi.mock("@/lib/verifyAuthToken", () => ({
  verifyAuthToken: verifyAuthTokenMock,
}));

function makeRequest(body: unknown, withAuth = true) {
  return new Request("http://localhost/api/notifications/click", {
    method: "POST",
    headers: {
      ...(withAuth ? { authorization: "Bearer test-token" } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/notifications/click", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAuthTokenMock.mockResolvedValue({ userId: "user-1" });
  });

  it("records click for authenticated user (first-write-wins)", async () => {
    findByIdMock.mockResolvedValue({
      _id: "match-1",
      userId: "user-1",
      clickedAt: null,
    });
    updateOneMock.mockResolvedValue(undefined);

    const response = await POST(makeRequest({ matchId: "match-1" }) as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(updateOneMock).toHaveBeenCalledWith("match-1", {
      clickedAt: expect.any(String),
    });
  });

  it("does not overwrite existing clickedAt (first-write-wins)", async () => {
    findByIdMock.mockResolvedValue({
      _id: "match-1",
      userId: "user-1",
      clickedAt: "2026-01-01T00:00:00.000Z",
    });

    const response = await POST(makeRequest({ matchId: "match-1" }) as any);

    expect(response.status).toBe(200);
    expect(updateOneMock).not.toHaveBeenCalled();
  });

  it("returns 404 when notification belongs to another user", async () => {
    findByIdMock.mockResolvedValue({
      _id: "match-1",
      userId: "user-2",
    });

    const response = await POST(makeRequest({ matchId: "match-1" }) as any);

    expect(response.status).toBe(404);
  });

  it("returns 404 when notification not found", async () => {
    findByIdMock.mockResolvedValue(null);

    const response = await POST(makeRequest({ matchId: "match-999" }) as any);

    expect(response.status).toBe(404);
  });

  it("returns 400 when matchId is missing", async () => {
    const response = await POST(makeRequest({}) as any);
    expect(response.status).toBe(400);
  });

  it("records click without auth (unauthenticated SW fallback)", async () => {
    findByIdMock.mockResolvedValue({
      _id: "match-1",
      userId: "user-1",
      clickedAt: null,
    });
    updateOneMock.mockResolvedValue(undefined);

    const response = await POST(makeRequest({ matchId: "match-1" }, false) as any);

    expect(response.status).toBe(200);
    expect(updateOneMock).toHaveBeenCalledWith("match-1", {
      clickedAt: expect.any(String),
    });
    // No ownership check for unauthenticated path
    expect(verifyAuthTokenMock).not.toHaveBeenCalled();
  });

  it("unauthenticated path does not overwrite existing clickedAt", async () => {
    findByIdMock.mockResolvedValue({
      _id: "match-1",
      userId: "user-1",
      clickedAt: "2026-01-01T00:00:00.000Z",
    });

    const response = await POST(makeRequest({ matchId: "match-1" }, false) as any);

    expect(response.status).toBe(200);
    expect(updateOneMock).not.toHaveBeenCalled();
  });

  it("unauthenticated path handles missing notification gracefully", async () => {
    findByIdMock.mockResolvedValue(null);

    const response = await POST(makeRequest({ matchId: "match-999" }, false) as any);

    // SW fallback — silently succeeds when notification not found
    expect(response.status).toBe(200);
    expect(updateOneMock).not.toHaveBeenCalled();
  });
});
