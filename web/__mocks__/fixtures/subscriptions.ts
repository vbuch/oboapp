import type { NotificationSubscription } from "@/lib/types";
import { MOCK_USER_ID } from "./interests";

/**
 * Static fixtures for notification subscriptions
 * 1-2 sample subscriptions for logged-in user
 */
export const MOCK_SUBSCRIPTIONS: NotificationSubscription[] = [
  {
    id: "sub-chrome-desktop",
    userId: MOCK_USER_ID,
    token: "mock-fcm-token-chrome",
    endpoint: "https://fcm.googleapis.com/fcm/send/mock-endpoint-1",
    createdAt: new Date("2026-01-15T10:05:00Z").toISOString(),
    updatedAt: new Date("2026-01-15T10:05:00Z").toISOString(),
    deviceInfo: {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      platform: "MacIntel",
    },
  },
  {
    id: "sub-mobile",
    userId: MOCK_USER_ID,
    token: "mock-fcm-token-mobile",
    endpoint: "https://fcm.googleapis.com/fcm/send/mock-endpoint-2",
    createdAt: new Date("2026-01-20T14:35:00Z").toISOString(),
    updatedAt: new Date("2026-01-20T14:35:00Z").toISOString(),
    deviceInfo: {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15",
      platform: "iPhone",
    },
  },
];
