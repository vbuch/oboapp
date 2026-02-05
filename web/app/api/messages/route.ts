import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { Message } from "@/lib/types";
import { convertTimestamp } from "@/lib/firestore-utils";
import {
  clampBounds,
  addBuffer,
  featureIntersectsBounds,
  type ViewportBounds,
} from "@/lib/bounds-utils";
import { getCentroid } from "@/lib/geometry-utils";
import { messagesQuerySchema } from "@/lib/api-query.schema";
import admin from "firebase-admin";

const { or, where } = admin.firestore.Filter;

const DEFAULT_RELEVANCE_DAYS = 7;
const CLUSTER_ZOOM_THRESHOLD = 15;

/**
 * Convert Firestore document to Message object
 * Returns only public MessageSchema fields
 */
function docToMessage(doc: FirebaseFirestore.DocumentSnapshot): Message {
  const data = doc.data();
  if (!data) {
    throw new Error(`Document ${doc.id} has no data`);
  }

  return {
    id: doc.id,
    text: data.text,
    addresses: data.addresses ? JSON.parse(data.addresses) : [],
    geoJson: data.geoJson ? JSON.parse(data.geoJson) : undefined,
    crawledAt: data.crawledAt ? convertTimestamp(data.crawledAt) : undefined,
    createdAt: convertTimestamp(data.createdAt),
    finalizedAt: data.finalizedAt
      ? convertTimestamp(data.finalizedAt)
      : undefined,
    source: data.source,
    sourceUrl: data.sourceUrl,
    markdownText: data.markdownText,
    categories: Array.isArray(data.categories) ? data.categories : [],
    timespanStart: data.timespanStart
      ? convertTimestamp(data.timespanStart)
      : undefined,
    timespanEnd: data.timespanEnd
      ? convertTimestamp(data.timespanEnd)
      : undefined,
    cityWide: data.cityWide || false,
    // Denormalized fields (native Firestore types, no parsing needed)
    responsibleEntity: data.responsibleEntity,
    pins: data.pins,
    streets: data.streets,
    cadastralProperties: data.cadastralProperties,
    busStops: data.busStops,
  };
}

export async function GET(request: Request) {
  try {
    // Validate query params
    const { searchParams } = new URL(request.url);
    const parsed = messagesQuerySchema.safeParse(
      Object.fromEntries(searchParams.entries()),
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { north, south, east, west, zoom, categories: selectedCategories } =
      parsed.data;

    let viewportBounds: ViewportBounds | null = null;
    if (
      north !== undefined &&
      south !== undefined &&
      east !== undefined &&
      west !== undefined
    ) {
      const rawBounds: ViewportBounds = { north, south, east, west };

      // Clamp to Sofia bounds
      const clampedBounds = clampBounds(rawBounds);
      // Add 20% buffer
      viewportBounds = addBuffer(clampedBounds, 0.2);
    }

    // Get relevance period from environment
    const relevanceDays = process.env.MESSAGE_RELEVANCE_DAYS
      ? Number.parseInt(process.env.MESSAGE_RELEVANCE_DAYS, 10)
      : DEFAULT_RELEVANCE_DAYS;

    // Calculate cutoff date for timespan filtering
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - relevanceDays);

    // If categories param was provided but resulted in empty array, return empty result
    if (selectedCategories && selectedCategories.length === 0) {
      return NextResponse.json({ messages: [] });
    }

    // Use Admin SDK for reading messages
    const messagesRef = adminDb.collection("messages");

    let allMessages: Message[] = [];

    // Apply category filtering if categories are selected
    if (selectedCategories && selectedCategories.length > 0) {
      // Separate uncategorized from real categories
      const realCategories = selectedCategories.filter(
        (c) => c !== "uncategorized",
      );
      const includeUncategorized = selectedCategories.includes("uncategorized");

      // If only uncategorized is selected, we need to fetch all and filter in memory
      // because Firestore doesn't have an index for categories == null with timespanEnd ordering
      if (includeUncategorized && realCategories.length === 0) {
        // Fetch messages with timespanEnd >= cutoffDate (server-side filtering)
        const snapshot = await messagesRef
          .where("timespanEnd", ">=", cutoffDate)
          .orderBy("timespanEnd", "desc")
          .get();

        const uncategorizedMessages: Message[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          const categories = data.categories;

          // Check if message is uncategorized
          const isUncategorized =
            !categories ||
            (Array.isArray(categories) && categories.length === 0);

          if (isUncategorized) {
            uncategorizedMessages.push(docToMessage(doc));
          }
        });

        allMessages = uncategorizedMessages;
      } else {
        // We have real categories (and possibly uncategorized)
        const queryPromises: Promise<FirebaseFirestore.QuerySnapshot>[] = [];

        // Query for real categories using OR filter with server-side timespan filtering
        if (realCategories.length > 0) {
          const categoryFilters = realCategories.map((cat) =>
            where("categories", "array-contains", cat),
          );

          const categoriesQuery = messagesRef
            .where(or(...categoryFilters))
            .where("timespanEnd", ">=", cutoffDate)
            .orderBy("timespanEnd", "desc");

          queryPromises.push(categoriesQuery.get());
        }

        // If uncategorized is also selected, fetch with timespan filter
        if (includeUncategorized) {
          const allMessagesQuery = messagesRef
            .where("timespanEnd", ">=", cutoffDate)
            .orderBy("timespanEnd", "desc");

          queryPromises.push(allMessagesQuery.get());
        }

        // Execute queries in parallel
        const snapshots = await Promise.all(queryPromises);

        // Merge results and deduplicate by message ID
        const messagesMap = new Map<string, Message>();

        for (let i = 0; i < snapshots.length; i++) {
          const snapshot = snapshots[i];
          const isUncategorizedSnapshot =
            includeUncategorized && i === snapshots.length - 1;

          snapshot.forEach((doc) => {
            const data = doc.data();

            // If this is the uncategorized snapshot, filter for uncategorized only
            if (isUncategorizedSnapshot) {
              const categories = data.categories;
              const isUncategorized =
                !categories ||
                (Array.isArray(categories) && categories.length === 0);
              if (!isUncategorized) return; // Skip categorized messages
            }

            // Only add if not already present (deduplication)
            if (!messagesMap.has(doc.id)) {
              messagesMap.set(doc.id, docToMessage(doc));
            }
          });
        }

        allMessages = Array.from(messagesMap.values());
      }
    } else {
      // No category filter - fetch all messages with timespan filter (server-side)
      const snapshot = await messagesRef
        .where("timespanEnd", ">=", cutoffDate)
        .orderBy("timespanEnd", "desc")
        .orderBy("createdAt", "desc")
        .get();

      snapshot.forEach((doc) => {
        allMessages.push(docToMessage(doc));
      });
    }

    // Include all messages with valid GeoJSON (no relevance filter needed - done in DB)
    let messages = allMessages.filter((message) => {
      return message.geoJson !== null && message.geoJson !== undefined;
    });

    // Filter by viewport bounds if provided (skip cityWide messages - they're always visible)
    if (viewportBounds) {
      messages = messages.filter((message) => {
        // City-wide messages bypass viewport filtering
        if (message.cityWide) return true;

        if (!message.geoJson?.features) return false;

        // Check if any feature intersects with viewport bounds
        return message.geoJson.features.some((feature) =>
          featureIntersectsBounds(feature, viewportBounds),
        );
      });
    }

    // Simplify geometry to centroids for low zoom levels (for clustering)
    if (zoom !== undefined && zoom < CLUSTER_ZOOM_THRESHOLD) {
      messages = messages.map((message) => {
        if (!message.geoJson?.features) return message;

        const simplifiedFeatures = message.geoJson.features.map((feature) => {
          // Only simplify LineString and Polygon to Points
          if (
            feature.geometry.type === "LineString" ||
            feature.geometry.type === "Polygon"
          ) {
            const centroid = getCentroid(feature.geometry);
            if (!centroid) return feature;
            return {
              ...feature,
              geometry: {
                type: "Point" as const,
                coordinates: [centroid.lng, centroid.lat] as [number, number],
              },
              properties: {
                ...feature.properties,
                _originalGeometryType: feature.geometry.type,
              },
            } as typeof feature;
          }
          return feature;
        });

        return {
          ...message,
          geoJson: {
            ...message.geoJson,
            features: simplifiedFeatures,
          },
        };
      });
    }

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 },
    );
  }
}
