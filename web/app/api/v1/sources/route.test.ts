import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { validateApiKeyMock, getSourcesMock } = vi.hoisted(() => ({
  validateApiKeyMock: vi.fn(),
  getSourcesMock: vi.fn(),
}));

vi.mock("@/lib/withApiKey", () => ({
  validateApiKey: validateApiKeyMock,
  apiKeyUnauthorizedResponse: vi.fn(() =>
    Response.json(
      {
        error:
          "Invalid or missing API key. Provide a valid X-Api-Key request header.",
      },
      { status: 401 },
    ),
  ),
}));

vi.mock("@/app/api/sources/route", () => ({
  GET: getSourcesMock,
}));

describe("GET /api/v1/sources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when API key is invalid", async () => {
    validateApiKeyMock.mockResolvedValue(false);

    const request = new Request("http://localhost/api/v1/sources");
    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(getSourcesMock).not.toHaveBeenCalled();
  });

  it("returns 401 when X-Api-Key header is missing", async () => {
    validateApiKeyMock.mockResolvedValue(false);

    const request = new Request("http://localhost/api/v1/sources");
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("X-Api-Key");
  });

  it("delegates to getSources when API key is valid", async () => {
    validateApiKeyMock.mockResolvedValue(true);
    getSourcesMock.mockResolvedValue(
      Response.json([{ id: "sofia-bg", name: "Sofia" }], { status: 200 }),
    );

    const request = new Request("http://localhost/api/v1/sources");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(getSourcesMock).toHaveBeenCalledTimes(1);
    const body = await response.json();
    expect(body).toEqual([{ id: "sofia-bg", name: "Sofia" }]);
  });
});
