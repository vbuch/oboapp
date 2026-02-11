import { describe, it, expect } from "vitest";
import { buildYsmOpenApi, ysmSchemas } from "@/lib/ysm-api-schema";

describe("YSM OpenAPI", () => {
  it("matches snapshot", () => {
    const document = buildYsmOpenApi();
    expect(document).toMatchSnapshot();
  });

  it("validates success response shapes", () => {
    expect(() =>
      ysmSchemas.sourcesResponse.parse({
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
      ysmSchemas.messagesResponse.parse({
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

    expect(() =>
      ysmSchemas.notificationHistoryResponse.parse([
        {
          id: "history-1",
          messageId: "msg-1",
          messageSnapshot: {
            text: "Test message",
            locality: "bg.sofia",
            createdAt:"2025-01-01T00:00:00.000Z",
          },
          notifiedAt: "2025-01-01T01:00:00.000Z",
          interestId: "interest-1",
          successfulDevicesCount: 1,
        },
      ]),
    ).not.toThrow();

    expect(() =>
      ysmSchemas.notificationSubscriptionStatusResponse.parse({
        hasSubscription: true,
      }),
    ).not.toThrow();

    expect(() =>
      ysmSchemas.notificationSubscriptionResponse.parse({
        id: "sub-1",
        userId: "user-1",
        token: "token",
        endpoint: "https://example.com/push",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
        deviceInfo: { userAgent: "ua", platform: "ios" },
      }),
    ).not.toThrow();

    expect(() =>
      ysmSchemas.notificationSubscriptionDeleteResponse.parse({
        success: true,
      }),
    ).not.toThrow();
  });

  it("uses generic error schema", () => {
    expect(() =>
      ysmSchemas.errorResponse.parse({
        error: "Something went wrong",
      }),
    ).not.toThrow();
  });
});
