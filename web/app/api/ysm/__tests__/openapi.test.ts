import { describe, it, expect } from "vitest";
import { buildYsmOpenApi, ysmSchemas } from "@/lib/ysm-api-schema";

describe("YSM OpenAPI", () => {
  it("exposes only YSM notification endpoints", () => {
    const document = buildYsmOpenApi();
    const paths = Object.keys(document.paths ?? {});

    expect(paths).toContain("/api/ysm/notifications/history");
    expect(paths).toContain("/api/ysm/notifications/subscription");
    expect(paths).not.toContain("/api/ysm/messages");
    expect(paths).not.toContain("/api/ysm/sources");
  });

  it("validates success response shapes", () => {
    expect(() =>
      ysmSchemas.notificationHistoryResponse.parse({
        items: [
          {
            id: "history-1",
            messageId: "msg-1",
            messageSnapshot: {
              text: "Test message",
              locality: "bg.sofia",
              createdAt: "2025-01-01T00:00:00.000Z",
            },
            notifiedAt: "2025-01-01T01:00:00.000Z",
            interestId: "interest-1",
            successfulDevicesCount: 1,
          },
        ],
        hasMore: false,
        nextOffset: null,
      }),
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
