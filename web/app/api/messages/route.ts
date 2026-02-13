import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { Message } from "@/lib/types";
import {
  clampBounds,
  addBuffer,
  featureIntersectsBounds,
  type ViewportBounds,
} from "@/lib/bounds-utils";
import { getCentroid } from "@/lib/geometry-utils";
import { messagesQuerySchema } from "@/lib/api-query.schema";
import { recordToMessage } from "@/lib/doc-to-message";

const DEFAULT_RELEVANCE_DAYS = 7;
const CLUSTER_ZOOM_THRESHOLD = 15;

export async function GET(request: Request) {
  try {
    const db = await getDb();
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

    const {
      north,
      south,
      east,
      west,
      zoom,
      categories: selectedCategories,
      sources: selectedSources,
    } = parsed.data;

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

    // Validate and deduplicate sources
    // Note: Unlike categories, empty sources param (?sources=) is treated as "no filter"
    // to maintain backwards compatibility and allow flexible querying
    let validatedSources: string[] | undefined;
    if (selectedSources && selectedSources.length > 0) {
      const { getCurrentLocalitySources } = await import("@/lib/source-utils");
      const localitySources = getCurrentLocalitySources();
      const validSourceIds = new Set(localitySources.map((s) => s.id));
      
      // Deduplicate and filter to only valid sources for this locality
      const uniqueSources = Array.from(new Set(selectedSources));
      validatedSources = uniqueSources.filter((sourceId) =>
        validSourceIds.has(sourceId),
      );

      // If no valid sources remain after validation, return empty result
      if (validatedSources.length === 0) {
        return NextResponse.json({ messages: [] });
      }
    }

    // Query messages using database abstraction
    let allMessages: Message[] = [];

    // Determine if we need source filtering
    const hasSourceFilter = validatedSources && validatedSources.length > 0;
    const hasCategoryFilter = selectedCategories && selectedCategories.length > 0;

    // Apply filtering based on what's selected
    if (hasCategoryFilter && hasSourceFilter) {
      // Both category and source filters
      const realCategories = selectedCategories.filter(
        (c) => c !== "uncategorized",
      );
      const includeUncategorized = selectedCategories.includes("uncategorized");

      if (includeUncategorized && realCategories.length === 0) {
        // Only uncategorized + source filter
        const docs = await db.messages.findMany({
          where: [
            { field: "timespanEnd", op: ">=", value: cutoffDate },
          ],
          orderBy: [{ field: "timespanEnd", direction: "desc" }],
        });

        const sourceSet = new Set(validatedSources);
        allMessages = docs
          .filter((doc) => {
            const categories = doc.categories as string[] | undefined;
            const isUncategorized =
              !categories ||
              (Array.isArray(categories) && categories.length === 0);
            return isUncategorized && doc.source && sourceSet.has(doc.source as string);
          })
          .map(recordToMessage);
      } else {
        const queryPromises: Promise<Record<string, unknown>[]>[] = [];

        if (realCategories.length > 0) {
          queryPromises.push(
            db.messages.findMany({
              where: [
                { field: "categories", op: "array-contains-any", value: realCategories },
                { field: "timespanEnd", op: ">=", value: cutoffDate },
              ],
              orderBy: [{ field: "timespanEnd", direction: "desc" }],
            }),
          );
        }

        if (includeUncategorized) {
          queryPromises.push(
            db.messages.findMany({
              where: [
                { field: "timespanEnd", op: ">=", value: cutoffDate },
              ],
              orderBy: [{ field: "timespanEnd", direction: "desc" }],
            }),
          );
        }

        const results = await Promise.all(queryPromises);
        const messagesMap = new Map<string, Message>();
        const sourceSet = new Set(validatedSources);

        for (let i = 0; i < results.length; i++) {
          const docs = results[i];
          const isUncategorizedQuery =
            includeUncategorized && i === results.length - 1;

          for (const doc of docs) {
            if (isUncategorizedQuery) {
              const categories = doc.categories as string[] | undefined;
              const isUncategorized =
                !categories ||
                (Array.isArray(categories) && categories.length === 0);
              if (!isUncategorized) continue;
            }

            // Apply source filter
            const docId = doc._id as string;
            if (doc.source && sourceSet.has(doc.source as string)) {
              if (!messagesMap.has(docId)) {
                messagesMap.set(docId, recordToMessage(doc));
              }
            }
          }
        }

        allMessages = Array.from(messagesMap.values()).sort((a, b) => {
          const aEnd = a.timespanEnd ?? "";
          const bEnd = b.timespanEnd ?? "";
          if (aEnd !== bEnd) return bEnd.localeCompare(aEnd);
          const aCreated = a.createdAt ?? "";
          const bCreated = b.createdAt ?? "";
          return bCreated.localeCompare(aCreated);
        });
      }
    } else if (hasCategoryFilter) {
      // Only category filter
      const realCategories = selectedCategories.filter(
        (c) => c !== "uncategorized",
      );
      const includeUncategorized = selectedCategories.includes("uncategorized");

      if (includeUncategorized && realCategories.length === 0) {
        const docs = await db.messages.findMany({
          where: [
            { field: "timespanEnd", op: ">=", value: cutoffDate },
          ],
          orderBy: [{ field: "timespanEnd", direction: "desc" }],
        });

        allMessages = docs
          .filter((doc) => {
            const categories = doc.categories as string[] | undefined;
            return (
              !categories ||
              (Array.isArray(categories) && categories.length === 0)
            );
          })
          .map(recordToMessage);
      } else {
        const queryPromises: Promise<Record<string, unknown>[]>[] = [];

        if (realCategories.length > 0) {
          queryPromises.push(
            db.messages.findMany({
              where: [
                { field: "categories", op: "array-contains-any", value: realCategories },
                { field: "timespanEnd", op: ">=", value: cutoffDate },
              ],
              orderBy: [{ field: "timespanEnd", direction: "desc" }],
            }),
          );
        }

        if (includeUncategorized) {
          queryPromises.push(
            db.messages.findMany({
              where: [
                { field: "timespanEnd", op: ">=", value: cutoffDate },
              ],
              orderBy: [{ field: "timespanEnd", direction: "desc" }],
            }),
          );
        }

        const results = await Promise.all(queryPromises);
        const messagesMap = new Map<string, Message>();

        for (let i = 0; i < results.length; i++) {
          const docs = results[i];
          const isUncategorizedQuery =
            includeUncategorized && i === results.length - 1;

          for (const doc of docs) {
            if (isUncategorizedQuery) {
              const categories = doc.categories as string[] | undefined;
              const isUncategorized =
                !categories ||
                (Array.isArray(categories) && categories.length === 0);
              if (!isUncategorized) continue;
            }

            const docId = doc._id as string;
            if (!messagesMap.has(docId)) {
              messagesMap.set(docId, recordToMessage(doc));
            }
          }
        }

        allMessages = Array.from(messagesMap.values()).sort((a, b) => {
          const aEnd = a.timespanEnd ?? "";
          const bEnd = b.timespanEnd ?? "";
          if (aEnd !== bEnd) return bEnd.localeCompare(aEnd);
          const aCreated = a.createdAt ?? "";
          const bCreated = b.createdAt ?? "";
          return bCreated.localeCompare(aCreated);
        });
      }
    } else if (hasSourceFilter) {
      // Only source filter - use database-level filtering
      const queryPromises: Promise<Record<string, unknown>[]>[] = [];

      for (const source of validatedSources!) {
        queryPromises.push(
          db.messages.findMany({
            where: [
              { field: "source", op: "==", value: source },
              { field: "timespanEnd", op: ">=", value: cutoffDate },
            ],
            orderBy: [{ field: "timespanEnd", direction: "desc" }],
          }),
        );
      }

      const results = await Promise.all(queryPromises);
      const messagesMap = new Map<string, Message>();

      for (const docs of results) {
        for (const doc of docs) {
          const docId = doc._id as string;
          if (!messagesMap.has(docId)) {
            messagesMap.set(docId, recordToMessage(doc));
          }
        }
      }

      allMessages = Array.from(messagesMap.values()).sort((a, b) => {
        const aEnd = a.timespanEnd ?? "";
        const bEnd = b.timespanEnd ?? "";
        if (aEnd !== bEnd) return bEnd.localeCompare(aEnd);
        const aCreated = a.createdAt ?? "";
        const bCreated = b.createdAt ?? "";
        return bCreated.localeCompare(aCreated);
      });
    } else {
      // No filters - fetch all messages with timespan filter
      const docs = await db.messages.findMany({
        where: [
          { field: "timespanEnd", op: ">=", value: cutoffDate },
        ],
        orderBy: [
          { field: "timespanEnd", direction: "desc" },
          { field: "createdAt", direction: "desc" },
        ],
      });

      allMessages = docs.map(recordToMessage);
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

    // Source filtering is now done at database level (above)
    // No need for in-memory filtering

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
