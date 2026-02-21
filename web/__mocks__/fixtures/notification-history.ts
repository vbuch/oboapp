import type { NotificationHistoryItem } from "@oboapp/shared";
import { MOCK_MESSAGES } from "./messages";

/**
 * Static fixtures for notification history
 * Sample notification records for logged-in user
 */
export const MOCK_NOTIFICATION_HISTORY: NotificationHistoryItem[] = [
  {
    id: "notif-1",
    messageId: "msg-water-center-1",
    messageSnapshot: {
      text: MOCK_MESSAGES[0].text,
      createdAt: MOCK_MESSAGES[0].createdAt,
      source: MOCK_MESSAGES[0].source,
    },
    notifiedAt: new Date("2026-02-09T08:10:00Z").toISOString(),
    distance: 450, // meters from interest zone
    interestId: "interest-home",
    successfulDevicesCount: 2,
    // Unread notification
  },
  {
    id: "notif-2",
    messageId: "msg-heating-mladost-1",
    messageSnapshot: {
      text: MOCK_MESSAGES[3].text,
      createdAt: MOCK_MESSAGES[3].createdAt,
      source: MOCK_MESSAGES[3].source,
    },
    notifiedAt: new Date("2026-02-09T06:50:00Z").toISOString(),
    distance: 320,
    interestId: "interest-work",
    successfulDevicesCount: 1,
    // Unread notification
  },
  {
    id: "notif-3",
    messageId: "msg-weather-citywide-1",
    messageSnapshot: {
      text: MOCK_MESSAGES[9].text,
      createdAt: MOCK_MESSAGES[9].createdAt,
      source: MOCK_MESSAGES[9].source,
    },
    notifiedAt: new Date("2026-02-09T18:10:00Z").toISOString(),
    interestId: "interest-home", // City-wide messages sent to all interests
    successfulDevicesCount: 2,
    readAt: new Date("2026-02-09T18:15:00Z").toISOString(), // Read notification
  },
  {
    id: "notif-4",
    messageId: "msg-public-transport-center-3",
    messageSnapshot: {
      text: MOCK_MESSAGES[2].text,
      createdAt: MOCK_MESSAGES[2].createdAt,
      source: MOCK_MESSAGES[2].source,
    },
    notifiedAt: new Date("2026-02-09T14:20:00Z").toISOString(),
    distance: 780,
    interestId: "interest-home",
    successfulDevicesCount: 2,
    readAt: new Date("2026-02-09T14:25:00Z").toISOString(), // Read notification
  },
  {
    id: "notif-5",
    messageId: "msg-electricity-lozenets-1",
    messageSnapshot: {
      text: MOCK_MESSAGES[6].text,
      createdAt: MOCK_MESSAGES[6].createdAt,
      source: MOCK_MESSAGES[6].source,
    },
    notifiedAt: new Date("2026-02-07T12:20:00Z").toISOString(),
    distance: 950,
    interestId: "interest-home",
    successfulDevicesCount: 1,
    readAt: new Date("2026-02-07T12:22:00Z").toISOString(), // Read notification
  },
];
