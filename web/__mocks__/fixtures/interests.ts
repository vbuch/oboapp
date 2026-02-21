import type { Interest } from "@/lib/types";

/**
 * Static fixtures for user interest zones
 * 2 sample zones for logged-in user
 */

const MOCK_USER_ID = "mock-user-123";

export const MOCK_INTERESTS: Interest[] = [
  {
    id: "interest-home",
    userId: MOCK_USER_ID,
    coordinates: {
      lat: 42.6977, // Sofia city center
      lng: 23.3219,
    },
    radius: 500, // 500m default
    label: "Дома",
    color: "#3B82F6",
    createdAt: new Date("2026-01-15T10:00:00Z").toISOString(),
    updatedAt: new Date("2026-01-15T10:00:00Z").toISOString(),
  },
  {
    id: "interest-work",
    userId: MOCK_USER_ID,
    coordinates: {
      lat: 42.65, // Mladost area
      lng: 23.38,
    },
    radius: 800, // 800m radius
    label: "Офис",
    color: "#8B5CF6",
    createdAt: new Date("2026-01-20T14:30:00Z").toISOString(),
    updatedAt: new Date("2026-01-20T14:30:00Z").toISOString(),
  },
];

export { MOCK_USER_ID };
