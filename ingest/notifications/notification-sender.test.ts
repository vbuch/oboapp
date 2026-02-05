import { describe, it, expect } from "vitest";
import { buildNotificationPayload } from "./notification-sender";
import type { Message, NotificationMatch } from "@/lib/types";

describe("notification-sender", () => {
  describe("buildNotificationPayload", () => {
    const baseMessage: Message = {
      id: "msg123",
      text: "Test message",
      createdAt: "2026-02-05T12:00:00.000Z",
    };

    const baseMatch: NotificationMatch = {
      id: "match123",
      messageId: "msg123",
      userId: "user123",
      interestId: "int123",
      matchedAt: "2026-02-05T12:00:00.000Z",
      notified: false,
      distance: 250,
    };

    it("should truncate long messages to 100 characters", () => {
      const longMessage: Message = {
        ...baseMessage,
        text: "a".repeat(150),
      };

      const payload = buildNotificationPayload(longMessage, baseMatch);

      expect(payload.data.body).toContain("...");
      expect(payload.data.body.length).toBeLessThan(150);
    });

    it("should include distance in body when present", () => {
      const payload = buildNotificationPayload(baseMessage, baseMatch);

      expect(payload.data.body).toContain("250m от вашия район");
    });

    it("should not include distance when null", () => {
      const matchWithoutDistance: NotificationMatch = {
        ...baseMatch,
        distance: undefined,
      };

      const payload = buildNotificationPayload(
        baseMessage,
        matchWithoutDistance,
      );

      expect(payload.data.body).not.toContain("от вашия район");
      expect(payload.data.body).toBe("Test message");
    });

    it("should include all required FCM data fields", () => {
      const payload = buildNotificationPayload(baseMessage, baseMatch);

      expect(payload.data).toHaveProperty("title");
      expect(payload.data).toHaveProperty("body");
      expect(payload.data).toHaveProperty("icon");
      expect(payload.data).toHaveProperty("badge");
      expect(payload.data).toHaveProperty("messageId", "msg123");
      expect(payload.data).toHaveProperty("interestId", "int123");
      expect(payload.data).toHaveProperty("matchId", "match123");
      expect(payload.data).toHaveProperty("url");
    });

    it("should include webpush link", () => {
      const payload = buildNotificationPayload(baseMessage, baseMatch);

      expect(payload.webpush.fcmOptions.link).toContain("messageId=msg123");
    });
  });
});
