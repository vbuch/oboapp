import { describe, it, expect } from "vitest";
import { buildNotificationPayload } from "./notification-sender";
import type { Message, NotificationMatch } from "@/lib/types";

describe("notification-sender", () => {
  describe("buildNotificationPayload", () => {
    const baseMessage: Message = {
      id: "aB3xYz12",
      text: "Test message",
      locality: "bg.sofia",
      createdAt: "2026-02-05T12:00:00.000Z",
    };

    const baseMatch: NotificationMatch = {
      id: "match123",
      messageId: "aB3xYz12",
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
      expect(payload.data).toHaveProperty("messageId", "aB3xYz12");
      expect(payload.data).toHaveProperty("interestId", "int123");
      expect(payload.data).toHaveProperty("matchId", "match123");
      expect(payload.data).toHaveProperty("url");
    });

    it("should use message ID in URL (ID is the slug)", () => {
      const payload = buildNotificationPayload(baseMessage, baseMatch);

      expect(payload.data.url).toContain("/m/aB3xYz12");
      expect(payload.webpush.fcmOptions.link).toContain("/m/aB3xYz12");
    });

    it("should use plainText field when available", () => {
      const messageWithPlainText: Message = {
        ...baseMessage,
        text: "Original text with **markdown**",
        plainText: "Original text with markdown",
      };

      const payload = buildNotificationPayload(
        messageWithPlainText,
        baseMatch,
      );

      expect(payload.data.body).toContain("Original text with markdown");
      expect(payload.data.body).not.toContain("**");
    });

    it("should strip markdown from text when plainText is not available", () => {
      const messageWithMarkdown: Message = {
        ...baseMessage,
        text: "**непланирано** спиране на водата",
      };

      const payload = buildNotificationPayload(messageWithMarkdown, baseMatch);

      expect(payload.data.body).toContain("непланирано спиране на водата");
      expect(payload.data.body).not.toContain("**");
    });

    it("should strip various markdown patterns", () => {
      const testCases = [
        {
          input: "**bold text**",
          expected: "bold text",
        },
        {
          input: "*italic text*",
          expected: "italic text",
        },
        {
          input: "__bold with underscore__",
          expected: "bold with underscore",
        },
        {
          input: "_italic with underscore_",
          expected: "italic with underscore",
        },
        {
          input: "# Header text",
          expected: "Header text",
        },
        {
          input: "[link text](https://example.com)",
          expected: "link text",
        },
        {
          input: "`inline code`",
          expected: "inline code",
        },
        {
          input: "**Планирано** спиране на **ул. Граф Игнатиев**",
          expected: "Планирано спиране на ул. Граф Игнатиев",
        },
      ];

      for (const { input, expected } of testCases) {
        const messageWithMarkdown: Message = {
          ...baseMessage,
          text: input,
        };

        const payload = buildNotificationPayload(messageWithMarkdown, baseMatch);

        expect(payload.data.body).toContain(expected);
      }
    });

    it("should handle ERM-Zapad style markdown messages", () => {
      const ermMessage: Message = {
        ...baseMessage,
        text: "**непланирано**\n\n**Населено място:** София\n\n**Начало:** 12.02.2026 10:00\n\n**Край:** 12.02.2026 15:00",
      };

      const payload = buildNotificationPayload(ermMessage, baseMatch);

      expect(payload.data.body).not.toContain("**");
      expect(payload.data.body).toContain("непланирано");
      expect(payload.data.body).toContain("Населено място:");
    });

    it("should handle long markdown messages with truncation", () => {
      const longMarkdownMessage: Message = {
        ...baseMessage,
        text: "**" + "a".repeat(50) + "** " + "b".repeat(60),
      };

      const payload = buildNotificationPayload(longMarkdownMessage, baseMatch);

      expect(payload.data.body).toContain("...");
      expect(payload.data.body).not.toContain("**");
      expect(payload.data.body.length).toBeLessThan(150);
    });
  });
});
