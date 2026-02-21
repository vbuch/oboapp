import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";

const { findManyMock, updateOneMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  updateOneMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn().mockResolvedValue({
    notificationMatches: {
      findMany: findManyMock,
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

describe("POST /api/notifications/mark-all-read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAuthTokenMock.mockResolvedValue({ userId: "user-1" });
  });

  it("marks all unread notifications as read for authenticated user", async () => {
    findManyMock.mockResolvedValue([
      { _id: "notif-1", userId: "user-1", readAt: null },
      { _id: "notif-2", userId: "user-1", readAt: null },
    ]);
    updateOneMock.mockResolvedValue(undefined);

    const request = new Request("http://localhost/api/notifications/mark-all-read", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, count: 2 });
    expect(updateOneMock).toHaveBeenCalledTimes(2);
    expect(updateOneMock).toHaveBeenCalledWith("notif-1", {
      readAt: expect.any(String),
    });
    expect(updateOneMock).toHaveBeenCalledWith("notif-2", {
      readAt: expect.any(String),
    });
  });

  it("returns 0 count when no unread notifications", async () => {
    findManyMock.mockResolvedValue([]);

    const request = new Request("http://localhost/api/notifications/mark-all-read", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, count: 0 });
    expect(updateOneMock).not.toHaveBeenCalled();
  });

  it("only updates notifications for authenticated user", async () => {
    findManyMock.mockResolvedValue([
      { _id: "notif-1", userId: "user-1", readAt: null },
    ]);
    updateOneMock.mockResolvedValue(undefined);

    const request = new Request("http://localhost/api/notifications/mark-all-read", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
    });

    await POST(request as any);

    // Verify only user-1's notifications were fetched and updated
    expect(findManyMock).toHaveBeenCalledWith({
      where: [
        { field: "userId", op: "==", value: "user-1" },
        { field: "notified", op: "==", value: true },
      ],
      select: ["_id", "readAt"],
    });
    expect(updateOneMock).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when database fails", async () => {
    findManyMock.mockRejectedValue(new Error("DB connection failed"));

    const request = new Request("http://localhost/api/notifications/mark-all-read", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to mark all notifications as read");
  });

  it("handles partial failures gracefully", async () => {
    findManyMock.mockResolvedValue([
      { _id: "notif-1", userId: "user-1", readAt: null },
      { _id: "notif-2", userId: "user-1", readAt: null },
    ]);
    updateOneMock
      .mockResolvedValueOnce(undefined) // First succeeds
      .mockRejectedValueOnce(new Error("Update failed")); // Second fails

    const request = new Request("http://localhost/api/notifications/mark-all-read", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    // Should still return 500 even if some succeed
    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to mark all notifications as read");
  });

  it("returns 401 when authentication fails", async () => {
    verifyAuthTokenMock.mockRejectedValue(new Error("Invalid auth token"));

    const request = new Request("http://localhost/api/notifications/mark-all-read", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain("Unauthorized");
  });
});
