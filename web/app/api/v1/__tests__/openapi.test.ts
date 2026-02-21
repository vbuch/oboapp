import { describe, it, expect } from "vitest";
import { buildV1OpenApi, v1Schemas } from "@/lib/v1-api-schema";

describe("V1 OpenAPI", () => {
  it("matches snapshot", () => {
    const document = buildV1OpenApi();
    expect(document).toMatchSnapshot();
  });

  it("includes API key security scheme", () => {
    const document = buildV1OpenApi();
    expect(document.components?.securitySchemes).toHaveProperty("ApiKeyAuth");
    const scheme = document.components?.securitySchemes?.["ApiKeyAuth"] as {
      type: string;
      in: string;
      name: string;
    };
    expect(scheme.type).toBe("apiKey");
    expect(scheme.in).toBe("header");
    expect(scheme.name).toBe("X-Api-Key");
  });

  it("exposes only public data endpoints (no notification routes)", () => {
    const document = buildV1OpenApi();
    const paths = Object.keys(document.paths ?? {});
    expect(paths).toContain("/api/v1/sources");
    expect(paths).toContain("/api/v1/messages");
    expect(paths).toContain("/api/v1/messages/by-id");
    expect(paths.some((p) => p.includes("notification"))).toBe(false);
  });

  it("validates success response shapes", () => {
    expect(() =>
      v1Schemas.sourcesResponse.parse({
        sources: [
          {
            id: "source-1",
            name: "Source One",
            url: "https://example.com",
            logoUrl: "https://example.com/logo.png",
            locality: "bg.sofia",
          },
        ],
      }),
    ).not.toThrow();

    expect(() =>
      v1Schemas.messagesResponse.parse({
        messages: [
          {
            id: "msg-1",
            text: "Test message",
            locality: "bg.sofia",
            markdownText: "Test",
            addresses: [
              {
                originalText: "ул. Тест 1",
                formattedAddress: "ул. Тест 1, София",
                coordinates: { lat: 42.7, lng: 23.3 },
                geoJson: { type: "Point", coordinates: [23.3, 42.7] },
              },
            ],
            responsibleEntity: "Test",
            pins: [
              {
                address: "ул. Тест 1",
                timespans: [
                  { start: "01.01.2025 08:00", end: "01.01.2025 18:00" },
                ],
              },
            ],
            streets: [],
            geoJson: {
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  geometry: { type: "Point", coordinates: [23.3, 42.7] },
                  properties: {},
                },
              ],
            },
            createdAt: "2025-01-01T00:00:00.000Z",
            categories: ["traffic"],
          },
        ],
      }),
    ).not.toThrow();
  });

  it("uses generic error schema", () => {
    expect(() =>
      v1Schemas.errorResponse.parse({
        error: "Something went wrong",
      }),
    ).not.toThrow();
  });
});
