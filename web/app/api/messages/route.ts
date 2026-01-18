import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { Message, Timespan } from "@/lib/types";
import { convertTimestamp } from "@/lib/firestore-utils";
import {
  clampBounds,
  addBuffer,
  featureIntersectsBounds,
  type ViewportBounds,
} from "@/lib/bounds-utils";
import admin from "firebase-admin";

const { or, where } = admin.firestore.Filter;

const DEFAULT_RELEVANCE_DAYS = 7;

/**
 * Parse a timespan end date string in format "DD.MM.YYYY HH:MM" to Date object
 */
function parseTimespanDate(dateStr: string): Date | null {
  try {
    // Expected format: "DD.MM.YYYY HH:MM"
    const regex = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/;
    const parts = regex.exec(dateStr);
    if (!parts) return null;

    const [, day, month, year, hours, minutes] = parts;
    return new Date(
      Number.parseInt(year),
      Number.parseInt(month) - 1, // JS months are 0-indexed
      Number.parseInt(day),
      Number.parseInt(hours),
      Number.parseInt(minutes),
    );
  } catch {
    return null;
  }
}

/**
 * Check if a message is still relevant based on its timespans or creation date
 */
function isMessageRelevant(message: Message, cutoffDate: Date): boolean {
  // If message has extracted data with timespans, check them
  if (message.extractedData) {
    const extractedData = message.extractedData;
    const allTimespans: Timespan[] = [];

    // Collect all timespans from pins
    if (extractedData.pins) {
      extractedData.pins.forEach((pin) => {
        if (pin.timespans && Array.isArray(pin.timespans)) {
          allTimespans.push(...pin.timespans);
        }
      });
    }

    // Collect all timespans from streets
    if (extractedData.streets) {
      extractedData.streets.forEach((street) => {
        if (street.timespans && Array.isArray(street.timespans)) {
          allTimespans.push(...street.timespans);
        }
      });
    }

    // If we have timespans, check if any have valid end dates
    if (allTimespans.length > 0) {
      const hasAnyValidTimespan = allTimespans.some((timespan) => {
        if (!timespan.end) return false;
        const endDate = parseTimespanDate(timespan.end);
        return endDate !== null;
      });

      // If we have at least one valid timespan, use timespan-based logic
      if (hasAnyValidTimespan) {
        return allTimespans.some((timespan) => {
          if (!timespan.end) return false;
          const endDate = parseTimespanDate(timespan.end);
          return endDate && endDate >= cutoffDate;
        });
      }
      // All timespans are invalid - fall back to createdAt
    }
  }

  // No timespans found or all timespans invalid - use createdAt date
  const createdAt = new Date(message.createdAt);
  return createdAt >= cutoffDate;
}

export async function GET(request: Request) {
  try {
    // Parse viewport bounds and zoom from query params
    const { searchParams } = new URL(request.url);
    const boundsParam = {
      north: searchParams.get("north"),
      south: searchParams.get("south"),
      east: searchParams.get("east"),
      west: searchParams.get("west"),
    };
    const zoomParam = searchParams.get("zoom");
    const zoom = zoomParam ? Number.parseFloat(zoomParam) : undefined;

    // Parse categories filter
    const categoriesParam = searchParams.get("categories");
    const selectedCategories = categoriesParam
      ? categoriesParam
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
      : null;

    let viewportBounds: ViewportBounds | null = null;
    if (
      boundsParam.north &&
      boundsParam.south &&
      boundsParam.east &&
      boundsParam.west
    ) {
      const rawBounds: ViewportBounds = {
        north: Number.parseFloat(boundsParam.north),
        south: Number.parseFloat(boundsParam.south),
        east: Number.parseFloat(boundsParam.east),
        west: Number.parseFloat(boundsParam.west),
      };

      // Clamp to Sofia bounds
      const clampedBounds = clampBounds(rawBounds);
      // Add 20% buffer
      viewportBounds = addBuffer(clampedBounds, 0.2);
    }

    // Get relevance period from environment
    const relevanceDays = process.env.MESSAGE_RELEVANCE_DAYS
      ? Number.parseInt(process.env.MESSAGE_RELEVANCE_DAYS, 10)
      : DEFAULT_RELEVANCE_DAYS;

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - relevanceDays);

    // If categories are selected but empty array, return empty result
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
      // because Firestore doesn't have an index for categories == null with finalizedAt ordering
      if (includeUncategorized && realCategories.length === 0) {
        // Fetch all finalized messages and filter for uncategorized in memory
        const snapshot = await messagesRef
          .where("finalizedAt", "!=", null)
          .orderBy("finalizedAt", "desc")
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
            uncategorizedMessages.push({
              id: doc.id,
              text: data.text,
              addresses: data.addresses ? JSON.parse(data.addresses) : [],
              extractedData: data.extractedData
                ? JSON.parse(data.extractedData)
                : undefined,
              geoJson: data.geoJson ? JSON.parse(data.geoJson) : undefined,
              createdAt: convertTimestamp(data.createdAt),
              crawledAt: data.crawledAt
                ? convertTimestamp(data.crawledAt)
                : undefined,
              finalizedAt: data.finalizedAt
                ? convertTimestamp(data.finalizedAt)
                : undefined,
              source: data.source,
              sourceUrl: data.sourceUrl,
              categories: Array.isArray(data.categories) ? data.categories : [],
            });
          }
        });

        allMessages = uncategorizedMessages;
      } else {
        // We have real categories (and possibly uncategorized)
        const queryPromises: Promise<FirebaseFirestore.QuerySnapshot>[] = [];

        // Query for real categories using OR filter
        if (realCategories.length > 0) {
          const categoryFilters = realCategories.map((cat) =>
            where("categories", "array-contains", cat),
          );

          const categoriesQuery = messagesRef
            .where(or(...categoryFilters))
            .where("finalizedAt", "!=", null)
            .orderBy("finalizedAt", "desc");

          queryPromises.push(categoriesQuery.get());
        }

        // If uncategorized is also selected, fetch all and filter in memory
        if (includeUncategorized) {
          const allMessagesQuery = messagesRef
            .where("finalizedAt", "!=", null)
            .orderBy("finalizedAt", "desc");

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
              messagesMap.set(doc.id, {
                id: doc.id,
                text: data.text,
                addresses: data.addresses ? JSON.parse(data.addresses) : [],
                extractedData: data.extractedData
                  ? JSON.parse(data.extractedData)
                  : undefined,
                geoJson: data.geoJson ? JSON.parse(data.geoJson) : undefined,
                createdAt: convertTimestamp(data.createdAt),
                crawledAt: data.crawledAt
                  ? convertTimestamp(data.crawledAt)
                  : undefined,
                finalizedAt: data.finalizedAt
                  ? convertTimestamp(data.finalizedAt)
                  : undefined,
                source: data.source,
                sourceUrl: data.sourceUrl,
                categories: Array.isArray(data.categories)
                  ? data.categories
                  : [],
              });
            }
          });
        }

        allMessages = Array.from(messagesMap.values());
      }
    } else {
      // No category filter - fetch all messages (original behavior)
      const snapshot = await messagesRef.orderBy("createdAt", "desc").get();

      snapshot.forEach((doc) => {
        const data = doc.data();
        allMessages.push({
          id: doc.id,
          text: data.text,
          addresses: data.addresses ? JSON.parse(data.addresses) : [],
          extractedData: data.extractedData
            ? JSON.parse(data.extractedData)
            : undefined,
          geoJson: data.geoJson ? JSON.parse(data.geoJson) : undefined,
          createdAt: convertTimestamp(data.createdAt),
          crawledAt: data.crawledAt
            ? convertTimestamp(data.crawledAt)
            : undefined,
          finalizedAt: data.finalizedAt
            ? convertTimestamp(data.finalizedAt)
            : undefined,
          source: data.source,
          sourceUrl: data.sourceUrl,
          categories: Array.isArray(data.categories) ? data.categories : [],
        });
      });
    }

    // Filter messages by relevance
    const relevantMessages = allMessages.filter((message) =>
      isMessageRelevant(message, cutoffDate),
    );

    // Include all messages with valid GeoJSON
    let messages = relevantMessages.filter((message) => {
      return message.geoJson !== null && message.geoJson !== undefined;
    });

    // Filter by viewport bounds if provided
    if (viewportBounds) {
      messages = messages.filter((message) => {
        if (!message.geoJson?.features) return false;

        // Check if any feature intersects with viewport bounds
        return message.geoJson.features.some((feature) =>
          featureIntersectsBounds(feature, viewportBounds),
        );
      });
    }

    // Simplify geometry to centroids for zoom levels < 15 (for clustering)
    if (zoom !== undefined && zoom < 15) {
      messages = messages.map((message) => {
        if (!message.geoJson?.features) return message;

        const simplifiedFeatures = message.geoJson.features.map((feature) => {
          // Only simplify LineString and Polygon to Points
          if (
            feature.geometry.type === "LineString" ||
            feature.geometry.type === "Polygon"
          ) {
            // Calculate centroid
            let centroid: [number, number];
            if (feature.geometry.type === "LineString") {
              const coords = feature.geometry.coordinates as [number, number][];
              const avgLng =
                coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
              const avgLat =
                coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
              centroid = [avgLng, avgLat];
            } else {
              // Polygon
              const coords = feature.geometry.coordinates[0] as [
                number,
                number,
              ][];
              const avgLng =
                coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
              const avgLat =
                coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
              centroid = [avgLng, avgLat];
            }

            return {
              ...feature,
              geometry: {
                type: "Point" as const,
                coordinates: centroid,
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
