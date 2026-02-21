import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { validateApiKeyMock, getMessagesMock } = vi.hoisted(() => ({
  validateApiKeyMock: vi.fn(),
  getMessagesMock: vi.fn(),
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

vi.mock("@/app/api/messages/route", () => ({
  GET: getMessagesMock,
}));

describe("GET /api/v1/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when API key is invalid", async () => {
    validateApiKeyMock.mockResolvedValue(false);

    const request = new Request("http://localhost/api/v1/messages");
    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(getMessagesMock).not.toHaveBeenCalled();
  });

  it("forwards request unchanged when sources is absent", async () => {
    validateApiKeyMock.mockResolvedValue(true);
    getMessagesMock.mockResolvedValue(
      Response.json({ success: true }, { status: 200 }),
    );

    const request = new Request(
      "http://localhost/api/v1/messages?north=42.7&categories=water",
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(getMessagesMock).toHaveBeenCalledTimes(1);
    expect(getMessagesMock).toHaveBeenCalledWith(request);
  });

  it("forwards request unchanged when sources is present", async () => {
    validateApiKeyMock.mockResolvedValue(true);
    getMessagesMock.mockResolvedValue(
      Response.json({ success: true }, { status: 200 }),
    );

    const request = new Request(
      "http://localhost/api/v1/messages?north=42.7&sources=foo,bar&categories=water",
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(getMessagesMock).toHaveBeenCalledTimes(1);
    expect(getMessagesMock).toHaveBeenCalledWith(request);
  });
});
