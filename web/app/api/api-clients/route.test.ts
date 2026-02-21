import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, DELETE } from "./route";

const { findByUserIdMock, createForUserMock, deleteOneMock, verifyAuthTokenMock } =
  vi.hoisted(() => ({
    findByUserIdMock: vi.fn(),
    createForUserMock: vi.fn(),
    deleteOneMock: vi.fn(),
    verifyAuthTokenMock: vi.fn().mockResolvedValue({ userId: "user-1" }),
  }));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn().mockResolvedValue({
    apiClients: {
      findByUserId: findByUserIdMock,
      createForUser: createForUserMock,
      deleteOne: deleteOneMock,
    },
  }),
}));

vi.mock("@/lib/verifyAuthToken", () => ({
  verifyAuthToken: verifyAuthTokenMock,
}));

const makeRequest = (method: string, body?: unknown) =>
  new Request(`http://localhost/api/api-clients`, {
    method,
    headers: {
      authorization: "Bearer test-token",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

const MOCK_CLIENT = {
  userId: "user-1",
  apiKey: "obo_test123",
  websiteUrl: "https://example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("GET /api/api-clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAuthTokenMock.mockResolvedValue({ userId: "user-1" });
  });

  it("returns null when no API client exists", async () => {
    findByUserIdMock.mockResolvedValue(null);
    const response = await GET(makeRequest("GET") as any);
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  it("returns the API client when one exists", async () => {
    findByUserIdMock.mockResolvedValue(MOCK_CLIENT);
    const response = await GET(makeRequest("GET") as any);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({
      id: "user-1",
      userId: "user-1",
      apiKey: "obo_test123",
      websiteUrl: "https://example.com",
    });
  });

  it("returns 401 when auth token is missing", async () => {
    verifyAuthTokenMock.mockRejectedValue(new Error("Missing auth token"));
    const response = await GET(makeRequest("GET") as any);
    expect(response.status).toBe(401);
  });

  it("returns 401 when auth token is invalid", async () => {
    verifyAuthTokenMock.mockRejectedValue(new Error("Invalid auth token"));
    const response = await GET(makeRequest("GET") as any);
    expect(response.status).toBe(401);
  });

  it("returns 500 when db throws", async () => {
    findByUserIdMock.mockRejectedValue(new Error("db error"));
    const response = await GET(makeRequest("GET") as any);
    expect(response.status).toBe(500);
  });
});

describe("POST /api/api-clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAuthTokenMock.mockResolvedValue({ userId: "user-1" });
  });

  it("creates an API client and returns 201", async () => {
    createForUserMock.mockResolvedValue("user-1");
    const response = await POST(
      makeRequest("POST", { websiteUrl: "https://example.com" }) as any,
    );
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data).toMatchObject({
      id: "user-1",
      userId: "user-1",
      websiteUrl: "https://example.com",
    });
    expect(typeof data.apiKey).toBe("string");
    expect(data.apiKey.startsWith("obo_")).toBe(true);
  });

  it("returns 400 for invalid websiteUrl", async () => {
    const response = await POST(
      makeRequest("POST", { websiteUrl: "not-a-url" }) as any,
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for non-http websiteUrl", async () => {
    const response = await POST(
      makeRequest("POST", { websiteUrl: "ftp://example.com" }) as any,
    );
    expect(response.status).toBe(400);
  });

  it("returns 401 when auth token is missing", async () => {
    verifyAuthTokenMock.mockRejectedValue(new Error("Missing auth token"));
    const response = await POST(
      makeRequest("POST", { websiteUrl: "https://example.com" }) as any,
    );
    expect(response.status).toBe(401);
  });

  it("returns 409 when user already has an API key (ALREADY_EXISTS error)", async () => {
    const err = new Error("ALREADY_EXISTS");
    createForUserMock.mockRejectedValue(err);
    const response = await POST(
      makeRequest("POST", { websiteUrl: "https://example.com" }) as any,
    );
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toContain("already have an API key");
  });

  it("returns 409 when user already has an API key (already exists error)", async () => {
    const err = new Error("document already exists");
    createForUserMock.mockRejectedValue(err);
    const response = await POST(
      makeRequest("POST", { websiteUrl: "https://example.com" }) as any,
    );
    expect(response.status).toBe(409);
  });

  it("returns 500 for non-duplicate db errors", async () => {
    createForUserMock.mockRejectedValue(new Error("connection refused"));
    const response = await POST(
      makeRequest("POST", { websiteUrl: "https://example.com" }) as any,
    );
    expect(response.status).toBe(500);
  });
});

describe("DELETE /api/api-clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAuthTokenMock.mockResolvedValue({ userId: "user-1" });
  });

  it("revokes the API client and returns success", async () => {
    findByUserIdMock.mockResolvedValue(MOCK_CLIENT);
    deleteOneMock.mockResolvedValue(undefined);
    const response = await DELETE(makeRequest("DELETE") as any);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(deleteOneMock).toHaveBeenCalledWith("user-1");
  });

  it("returns 401 when auth token is invalid", async () => {
    verifyAuthTokenMock.mockRejectedValue(new Error("Invalid auth token"));
    const response = await DELETE(makeRequest("DELETE") as any);
    expect(response.status).toBe(401);
  });

  it("returns 404 when no API client exists", async () => {
    findByUserIdMock.mockResolvedValue(null);
    const response = await DELETE(makeRequest("DELETE") as any);
    expect(response.status).toBe(404);
  });

  it("returns 500 when db throws during delete", async () => {
    findByUserIdMock.mockResolvedValue(MOCK_CLIENT);
    deleteOneMock.mockRejectedValue(new Error("db error"));
    const response = await DELETE(makeRequest("DELETE") as any);
    expect(response.status).toBe(500);
  });
});
