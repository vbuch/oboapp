import { http, HttpResponse } from "msw";
import { MOCK_MESSAGES } from "./fixtures/messages";
import { MOCK_INTERESTS, MOCK_USER_ID } from "./fixtures/interests";
import { MOCK_SUBSCRIPTIONS } from "./fixtures/subscriptions";
import { MOCK_NOTIFICATION_HISTORY } from "./fixtures/notification-history";
import type { Interest, NotificationSubscription } from "@/lib/types";
import type { Message } from "@oboapp/shared";

/**
 * MSW request handlers for API routes
 * Provides static mock responses for front-end development without Firebase emulators
 */

// In-memory state for CRUD operations
let interests: Interest[] = [...MOCK_INTERESTS];
let subscriptions: NotificationSubscription[] = [...MOCK_SUBSCRIPTIONS];

/**
 * Helper: Filter messages by viewport bounds
 */
function filterMessagesByViewport(
  messages: Message[],
  north?: number,
  south?: number,
  east?: number,
  west?: number,
): Message[] {
  if (
    north === undefined ||
    south === undefined ||
    east === undefined ||
    west === undefined
  ) {
    return messages;
  }

  return messages.filter((msg) => {
    // City-wide messages always visible
    if (msg.cityWide) return true;

    // Messages without GeoJSON not visible
    if (!msg.geoJson || msg.geoJson.features.length === 0) return false;

    // Check if any feature intersects viewport
    return msg.geoJson.features.some((feature) => {
      if (feature.geometry.type === "Point") {
        const [lng, lat] = feature.geometry.coordinates;
        return lat >= south && lat <= north && lng >= west && lng <= east;
      }

      if (feature.geometry.type === "LineString") {
        return feature.geometry.coordinates.some(([lng, lat]) => {
          return lat >= south && lat <= north && lng >= west && lng <= east;
        });
      }

      if (feature.geometry.type === "Polygon") {
        return feature.geometry.coordinates[0].some(([lng, lat]) => {
          return lat >= south && lat <= north && lng >= west && lng <= east;
        });
      }

      return false;
    });
  });
}

/**
 * Helper: Filter messages by categories
 */
function filterMessagesByCategories(
  messages: Message[],
  categories?: string[],
): Message[] {
  if (!categories || categories.length === 0) {
    return messages;
  }

  const includeUncategorized = categories.includes("uncategorized");
  const realCategories = categories.filter((c) => c !== "uncategorized");

  return messages.filter((msg) => {
    const hasNoCategories = !msg.categories || msg.categories.length === 0;

    if (includeUncategorized && hasNoCategories) return true;

    if (realCategories.length === 0) return false;

    return msg.categories?.some((cat) => realCategories.includes(cat));
  });
}

export const handlers = [
  // GET /api/messages - Fetch messages with viewport/category filtering
  http.get("/api/messages", ({ request }) => {
    const url = new URL(request.url);
    const north = url.searchParams.get("north");
    const south = url.searchParams.get("south");
    const east = url.searchParams.get("east");
    const west = url.searchParams.get("west");
    const categoriesParam = url.searchParams.get("categories");

    const categories = categoriesParam
      ? categoriesParam.split(",").filter(Boolean)
      : undefined;

    let filteredMessages = [...MOCK_MESSAGES];

    // Apply viewport filtering
    filteredMessages = filterMessagesByViewport(
      filteredMessages,
      north ? Number.parseFloat(north) : undefined,
      south ? Number.parseFloat(south) : undefined,
      east ? Number.parseFloat(east) : undefined,
      west ? Number.parseFloat(west) : undefined,
    );

    // Apply category filtering
    filteredMessages = filterMessagesByCategories(filteredMessages, categories);

    return HttpResponse.json({ messages: filteredMessages });
  }),

  // GET /api/messages/[id] - Fetch single message by ID
  http.get("/api/messages/:id", ({ params }) => {
    const { id } = params;
    const message = MOCK_MESSAGES.find((m) => m.id === id);

    if (!message) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(message);
  }),

  // GET /api/messages/by-id?id=... - Fetch single message by ID (query param)
  http.get("/api/messages/by-id", ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return new HttpResponse(null, { status: 404 });
    }

    const message = MOCK_MESSAGES.find((m) => m.id === id);

    if (!message) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json({ message });
  }),

  // GET /api/interests - Fetch all interests for authenticated user
  http.get("/api/interests", () => {
    return HttpResponse.json({ interests });
  }),

  // POST /api/interests - Create new interest
  http.post("/api/interests", async ({ request }) => {
    const body = (await request.json()) as {
      coordinates: { lat: number; lng: number };
      radius: number;
    };

    const newInterest: Interest = {
      id: `interest-${Date.now()}`,
      userId: MOCK_USER_ID,
      coordinates: body.coordinates,
      radius: Math.max(100, Math.min(1000, body.radius || 500)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    interests.push(newInterest);
    return HttpResponse.json({ interest: newInterest }, { status: 201 });
  }),

  // PATCH /api/interests - Update interest (body contains id)
  http.patch("/api/interests", async ({ request }) => {
    const body = (await request.json()) as {
      id: string;
      coordinates?: { lat: number; lng: number };
      radius?: number;
    };
    const { id } = body;

    const index = interests.findIndex((i) => i.id === id);
    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    const updated: Interest = {
      ...interests[index],
      coordinates: body.coordinates ?? interests[index].coordinates,
      radius: body.radius
        ? Math.max(100, Math.min(1000, body.radius))
        : interests[index].radius,
      updatedAt: new Date().toISOString(),
    };

    interests[index] = updated;
    return HttpResponse.json({ interest: updated });
  }),

  // DELETE /api/interests?id=... - Delete interest
  http.delete("/api/interests", ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const index = interests.findIndex((i) => i.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    interests.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // GET /api/notifications/subscription - Check if user has subscription
  http.get("/api/notifications/subscription", () => {
    return HttpResponse.json({ hasSubscription: subscriptions.length > 0 });
  }),

  // POST /api/notifications/subscription - Create or update subscription
  http.post("/api/notifications/subscription", async ({ request }) => {
    const body = (await request.json()) as {
      token: string;
      endpoint: string;
      deviceInfo?: { userAgent?: string; platform?: string };
    };

    // Check if subscription exists
    const existing = subscriptions.find((s) => s.token === body.token);

    if (existing) {
      // Update existing
      existing.endpoint = body.endpoint;
      existing.deviceInfo = body.deviceInfo;
      existing.updatedAt = new Date().toISOString();
      return HttpResponse.json(existing);
    }

    // Create new subscription
    const newSubscription: NotificationSubscription = {
      id: `sub-${Date.now()}`,
      userId: MOCK_USER_ID,
      token: body.token,
      endpoint: body.endpoint,
      deviceInfo: body.deviceInfo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    subscriptions.push(newSubscription);
    return HttpResponse.json(newSubscription, { status: 201 });
  }),

  // DELETE /api/notifications/subscription - Delete subscription by token
  http.delete("/api/notifications/subscription", async ({ request }) => {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return HttpResponse.json(
        { error: "Token parameter required" },
        { status: 400 },
      );
    }

    const index = subscriptions.findIndex((s) => s.token === token);
    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    subscriptions.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // GET /api/notifications/subscription/all - Fetch all subscriptions
  http.get("/api/notifications/subscription/all", () => {
    return HttpResponse.json(subscriptions);
  }),

  // DELETE /api/notifications/subscription/all - Delete all subscriptions
  http.delete("/api/notifications/subscription/all", () => {
    const deleted = subscriptions.length;
    subscriptions.length = 0; // Clear array
    return HttpResponse.json({ success: true, deleted });
  }),

  // GET /api/notifications/history - Fetch notification history
  http.get("/api/notifications/history", () => {
    return HttpResponse.json(MOCK_NOTIFICATION_HISTORY);
  }),

  // GET /api/notifications/history/count - Get notification count
  http.get("/api/notifications/history/count", () => {
    return HttpResponse.json({ count: MOCK_NOTIFICATION_HISTORY.length });
  }),

  // DELETE /api/user - Delete user account (mock - just clear data)
  http.delete("/api/user", () => {
    // Reset to empty state
    interests = [];
    subscriptions = [];
    return new HttpResponse(null, { status: 204 });
  }),
];
