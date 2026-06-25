import { Hono } from "hono";
import { SOURCES } from "@oboapp/shared";
import { getDb } from "../lib/db";
import type { WhereClause } from "@oboapp/db";
import { recordToMessage } from "../lib/doc-to-message";
import { apiKeyAuth } from "../middleware/api-key";
import { rateLimit } from "../middleware/rate-limit";
import { usageMetrics } from "../middleware/usage-metrics";
import { messagesQuerySchema } from "../schema/query";
import type { Message, GeoJsonFeature } from "../schema/contract";
import {
  clampBounds,
  addBuffer,
  featureIntersectsBounds,
  type ViewportBounds,
} from "../lib/bounds-utils";
import { getCentroid } from "../lib/geometry-utils";
import {
  clampMessagesLimit,
  getDefaultUnfilteredMessagesLimit,
} from "../lib/messages-limit-config";

const DEFAULT_RELEVANCE_DAYS = 7;
const CLUSTER_ZOOM_THRESHOLD = 15;
const FIRESTORE_IN_OPERATOR_LIMIT = 10;
const AGGRESSIVE_CACHE_CONTROL =
  "public, s-maxage=3600, stale-while-revalidate=300";
const DEFAULT_AGGRESSIVE_CACHE_TTL_SECONDS = 3600;

type DbClient = Awaited<ReturnType<typeof getDb>>;
type MessageRecord = Record<string, unknown>;

interface MessagesCacheEntry {
  expiresAtMs: number;
  messages: Message[];
}

const unboundMessagesMemoryCache = new Map<string, MessagesCacheEntry>();

export function getAggressiveCacheTtlSeconds(): number {
  const raw = process.env.PUBLIC_API_MESSAGES_AGGRESSIVE_CACHE_TTL_SECONDS;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_AGGRESSIVE_CACHE_TTL_SECONDS;
  }
  return parsed;
}

export function getUnboundMessagesCacheKey(locality: string): string {
  return `${locality}:${getDefaultUnfilteredMessagesLimit()}`;
}

export function getCachedUnboundMessages(cacheKey: string): Message[] | null {
  const cached = unboundMessagesMemoryCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAtMs <= Date.now()) {
    unboundMessagesMemoryCache.delete(cacheKey);
    return null;
  }

  return cached.messages;
}

export function setCachedUnboundMessages(
  cacheKey: string,
  messages: Message[],
): void {
  const ttlMs = getAggressiveCacheTtlSeconds() * 1000;
  unboundMessagesMemoryCache.set(cacheKey, {
    expiresAtMs: Date.now() + ttlMs,
    messages,
  });
}

export function clearMessagesRouteCache(): void {
  unboundMessagesMemoryCache.clear();
}

function tryRecordToMessage(
  record: MessageRecord,
  context: string,
): Message | null {
  try {
    return recordToMessage(record);
  } catch (error) {
    const recordId = typeof record._id === "string" ? record._id : "unknown";
    console.warn("Skipping malformed message record", {
      context,
      recordId,
      error,
    });
    return null;
  }
}

function sortMessagesByRelevance(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => {
    const aFinalizedAt = a.finalizedAt ?? "";
    const bFinalizedAt = b.finalizedAt ?? "";
    if (aFinalizedAt !== bFinalizedAt) {
      return bFinalizedAt.localeCompare(aFinalizedAt);
    }

    const aEnd = a.timespanEnd ?? "";
    const bEnd = b.timespanEnd ?? "";
    return bEnd.localeCompare(aEnd);
  });
}

function isUncategorizedDoc(doc: MessageRecord): boolean {
  const categories = Array.isArray(doc.categories) ? doc.categories : undefined;
  return !categories || categories.length === 0;
}

function toViewportBounds(params: {
  north?: number;
  south?: number;
  east?: number;
  west?: number;
}): ViewportBounds | null {
  const { north, south, east, west } = params;
  if (
    north === undefined ||
    south === undefined ||
    east === undefined ||
    west === undefined
  ) {
    return null;
  }

  const rawBounds: ViewportBounds = { north, south, east, west };
  const clampedBounds = clampBounds(rawBounds);
  return addBuffer(clampedBounds, 0.2);
}

function getCutoffDate(override?: Date): Date {
  if (override) {
    return override;
  }

  const parsed = process.env.MESSAGE_RELEVANCE_DAYS
    ? Number.parseInt(process.env.MESSAGE_RELEVANCE_DAYS, 10)
    : DEFAULT_RELEVANCE_DAYS;
  const relevanceDays = Number.isNaN(parsed) ? DEFAULT_RELEVANCE_DAYS : parsed;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - relevanceDays);
  return cutoffDate;
}

async function findRecentMessageDocs(
  db: DbClient,
  cutoffDate: Date,
  locality?: string,
  limit?: number,
): Promise<MessageRecord[]> {
  const where: WhereClause[] = [
    { field: "timespanEnd", op: ">=", value: cutoffDate },
  ];
  if (locality) {
    where.push({ field: "locality", op: "==", value: locality });
  }
  return db.messages.findMany({
    where,
    orderBy: [{ field: "timespanEnd", direction: "desc" }],
    limit,
  });
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function findRecentMessageDocsBySources(
  db: DbClient,
  cutoffDate: Date,
  sources: string[],
  locality?: string,
  limit?: number,
): Promise<MessageRecord[]> {
  if (sources.length === 0) {
    return [];
  }

  const sourceChunks = chunkArray(sources, FIRESTORE_IN_OPERATOR_LIMIT);
  const chunkQueries = sourceChunks.map((sourceChunk) => {
    const where: WhereClause[] = [
      { field: "source", op: "in", value: sourceChunk },
      { field: "timespanEnd", op: ">=", value: cutoffDate },
    ];
    if (locality) {
      where.push({ field: "locality", op: "==", value: locality });
    }
    return db.messages.findMany({
      where,
      orderBy: [{ field: "timespanEnd", direction: "desc" }],
      limit,
    });
  });

  const chunkResults = await Promise.all(chunkQueries);
  return chunkResults.flat();
}

async function findMessagesBySources(
  db: DbClient,
  cutoffDate: Date,
  sources: string[],
  locality?: string,
  limit?: number,
): Promise<Message[]> {
  const results = await findRecentMessageDocsBySources(
    db,
    cutoffDate,
    sources,
    locality,
    limit,
  );
  const messagesMap = new Map<string, Message>();

  for (const doc of results) {
    const docId = typeof doc._id === "string" ? doc._id : "";
    if (docId && !messagesMap.has(docId)) {
      const message = tryRecordToMessage(doc, "findMessagesBySources");
      if (message) {
        messagesMap.set(docId, message);
      }
    }
  }

  return Array.from(messagesMap.values());
}

function toSourceList(sourceSet?: Set<string>): string[] {
  return sourceSet ? Array.from(sourceSet) : [];
}

async function findUncategorizedDocs(
  db: DbClient,
  cutoffDate: Date,
  sourceSet?: Set<string>,
  locality?: string,
  limit?: number,
): Promise<MessageRecord[]> {
  const sourceList = toSourceList(sourceSet);
  const docs = sourceList.length
    ? await findRecentMessageDocsBySources(
        db,
        cutoffDate,
        sourceList,
        locality,
        limit,
      )
    : await findRecentMessageDocs(db, cutoffDate, locality, limit);

  return docs.filter((doc) => isUncategorizedDoc(doc));
}

function dedupeAndMapMessages(docs: MessageRecord[]): Message[] {
  const messagesMap = new Map<string, Message>();

  for (const doc of docs) {
    const docId = typeof doc._id === "string" ? doc._id : "";
    if (docId && !messagesMap.has(docId)) {
      const message = tryRecordToMessage(doc, "dedupeAndMapMessages");
      if (message) {
        messagesMap.set(docId, message);
      }
    }
  }

  return Array.from(messagesMap.values());
}

function mapDocsToMessages(docs: MessageRecord[], context: string): Message[] {
  return docs
    .map((doc) => tryRecordToMessage(doc, context))
    .filter((message): message is Message => message !== null);
}

function addRecordToMessageMap(
  messagesMap: Map<string, Message>,
  doc: MessageRecord,
  context: string,
): void {
  const docId = typeof doc._id === "string" ? doc._id : "";
  if (!docId || messagesMap.has(docId)) {
    return;
  }

  const message = tryRecordToMessage(doc, context);
  if (message) {
    messagesMap.set(docId, message);
  }
}

function applyOptionalSourceSet(
  docs: MessageRecord[],
  sourceSet?: Set<string>,
): MessageRecord[] {
  if (!sourceSet) {
    return docs;
  }

  return docs.filter(
    (doc) => typeof doc.source === "string" && sourceSet.has(doc.source),
  );
}

function isInvalidSourceForFilter(
  doc: MessageRecord,
  sourceSet?: Set<string>,
): boolean {
  if (!sourceSet) {
    return false;
  }

  return (
    !doc.source || typeof doc.source !== "string" || !sourceSet.has(doc.source)
  );
}

async function buildCategoryQueryPlans(
  db: DbClient,
  cutoffDate: Date,
  realCategories: string[],
  includeUncategorized: boolean,
  sourceSet?: Set<string>,
  locality?: string,
  limit?: number,
): Promise<Array<{ uncategorizedOnly: boolean; docs: MessageRecord[] }>> {
  const plans: Array<
    Promise<{ uncategorizedOnly: boolean; docs: MessageRecord[] }>
  > = [];

  if (realCategories.length > 0) {
    const where: WhereClause[] = [
      {
        field: "categories",
        op: "array-contains-any",
        value: realCategories,
      },
      { field: "timespanEnd", op: ">=", value: cutoffDate },
    ];
    if (locality) {
      where.push({ field: "locality", op: "==", value: locality });
    }
    plans.push(
      db.messages
        .findMany({
          where,
          orderBy: [{ field: "timespanEnd", direction: "desc" }],
          limit,
        })
        .then((docs) => ({ uncategorizedOnly: false, docs })),
    );
  }

  if (includeUncategorized) {
    plans.push(
      findUncategorizedDocs(db, cutoffDate, sourceSet, locality, limit).then(
        (docs) => ({
          uncategorizedOnly: true,
          docs,
        }),
      ),
    );
  }

  return Promise.all(plans);
}

async function findMessagesByCategoryFilters(
  db: DbClient,
  cutoffDate: Date,
  selectedCategories: string[],
  sourceSet?: Set<string>,
  locality?: string,
  limit?: number,
): Promise<Message[]> {
  const realCategories = selectedCategories.filter(
    (c) => c !== "uncategorized",
  );
  const includeUncategorized = selectedCategories.includes("uncategorized");

  if (includeUncategorized && realCategories.length === 0) {
    const uncategorizedDocs = await findUncategorizedDocs(
      db,
      cutoffDate,
      sourceSet,
      locality,
      limit,
    );
    return dedupeAndMapMessages(uncategorizedDocs);
  }

  const queryPlans = await buildCategoryQueryPlans(
    db,
    cutoffDate,
    realCategories,
    includeUncategorized,
    sourceSet,
    locality,
    limit,
  );

  return mapCategoryQueryPlansToMessages(queryPlans, sourceSet);
}

function mapCategoryQueryPlansToMessages(
  queryPlans: Array<{ uncategorizedOnly: boolean; docs: MessageRecord[] }>,
  sourceSet?: Set<string>,
): Message[] {
  const messagesMap = new Map<string, Message>();

  for (const plan of queryPlans) {
    const candidateDocs = applyOptionalSourceSet(plan.docs, sourceSet);

    for (const doc of candidateDocs) {
      if (plan.uncategorizedOnly && !isUncategorizedDoc(doc)) {
        continue;
      }

      if (isInvalidSourceForFilter(doc, sourceSet)) {
        continue;
      }

      addRecordToMessageMap(messagesMap, doc, "findMessagesByCategoryFilters");
    }
  }

  return Array.from(messagesMap.values());
}

function getLocalitySourceIds(locality: string): Set<string> {
  return new Set(
    SOURCES.filter((source) => source.localities.includes(locality)).map(
      (source) => source.id,
    ),
  );
}

interface FetchMessagesForRequestParams {
  db: DbClient;
  cutoffDate: Date;
  categoryFilters: string[];
  sourceFilters: string[];
  hasCategoryFilter: boolean;
  hasSourceFilter: boolean;
  locality: string;
  explicitLimit?: number;
  queryFetchLimit?: number;
}

async function fetchMessagesForRequest(
  params: FetchMessagesForRequestParams,
): Promise<Message[]> {
  const {
    db,
    cutoffDate,
    categoryFilters,
    sourceFilters,
    hasCategoryFilter,
    hasSourceFilter,
    locality,
    explicitLimit,
    queryFetchLimit,
  } = params;

  if (hasCategoryFilter) {
    const sourceSet = hasSourceFilter ? new Set(sourceFilters) : undefined;
    return findMessagesByCategoryFilters(
      db,
      cutoffDate,
      categoryFilters,
      sourceSet,
      locality,
      queryFetchLimit,
    );
  }

  if (hasSourceFilter) {
    return findMessagesBySources(
      db,
      cutoffDate,
      sourceFilters,
      locality,
      queryFetchLimit,
    );
  }

  const where: WhereClause[] = [
    { field: "timespanEnd", op: ">=", value: cutoffDate },
    { field: "locality", op: "==", value: locality },
  ];

  const defaultBoundedLimit =
    explicitLimit ?? getDefaultUnfilteredMessagesLimit();
  const docs = await db.messages.findMany({
    where,
    orderBy: [{ field: "timespanEnd", direction: "desc" }],
    limit: clampMessagesLimit(defaultBoundedLimit),
  });

  return mapDocsToMessages(docs, "messagesRoute.defaultQuery");
}

export function shouldApplyAggressiveCache(params: {
  hasCategoryFilter: boolean;
  hasSourceFilter: boolean;
  hasViewport: boolean;
  zoom?: number;
  timespanEndGte?: Date;
  limit?: number;
}): boolean {
  const {
    hasCategoryFilter,
    hasSourceFilter,
    hasViewport,
    zoom,
    timespanEndGte,
    limit,
  } = params;

  return (
    !hasCategoryFilter &&
    !hasSourceFilter &&
    !hasViewport &&
    zoom === undefined &&
    timespanEndGte === undefined &&
    limit === undefined
  );
}

function filterMessagesByGeoAndViewport(
  messages: Message[],
  viewportBounds: ViewportBounds | null,
): Message[] {
  let filtered = messages.filter(
    (message) =>
      message.cityWide ||
      (message.geoJson !== null && message.geoJson !== undefined),
  );

  if (!viewportBounds) {
    return filtered;
  }

  filtered = filtered.filter((message) => {
    if (message.cityWide) return true;
    if (!message.geoJson?.features) return false;

    return message.geoJson.features.some((feature) =>
      featureIntersectsBounds(feature, viewportBounds),
    );
  });

  return filtered;
}

function simplifyMessagesForClusterZoom(
  messages: Message[],
  zoom?: number,
): Message[] {
  if (zoom === undefined || zoom >= CLUSTER_ZOOM_THRESHOLD) {
    return messages;
  }

  return messages.map((message) => {
    if (!message.geoJson?.features) return message;

    const simplifiedFeatures: GeoJsonFeature[] = message.geoJson.features.map(
      (feature) => {
        if (
          feature.geometry.type === "LineString" ||
          feature.geometry.type === "Polygon"
        ) {
          const centroid = getCentroid(feature.geometry);
          if (!centroid) return feature;

          const simplified: GeoJsonFeature = {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [centroid.lng, centroid.lat],
            },
            properties: {
              ...feature.properties,
              _originalGeometryType: feature.geometry.type,
            },
          };
          return simplified;
        }

        return feature;
      },
    );

    return {
      ...message,
      geoJson: {
        ...message.geoJson,
        features: simplifiedFeatures,
      },
    };
  });
}

function getValidatedSources(
  selectedSources: string[] | undefined,
  allSourceIds: Set<string>,
): string[] | undefined {
  if (!selectedSources || selectedSources.length === 0) {
    return undefined;
  }

  const uniqueSources = Array.from(new Set(selectedSources));
  return uniqueSources.filter((sourceId) => allSourceIds.has(sourceId));
}

export const messagesRoute = new Hono();

messagesRoute.get(
  "/messages",
  apiKeyAuth,
  rateLimit,
  usageMetrics,
  async (c) => {
    try {
      const db = await getDb();

      const parsed = messagesQuerySchema.safeParse(
        Object.fromEntries(new URL(c.req.url).searchParams.entries()),
      );

      if (!parsed.success) {
        return c.json({ error: "Invalid query parameters" }, 400);
      }

      const {
        north,
        south,
        east,
        west,
        zoom,
        categories: selectedCategories,
        sources: selectedSources,
        timespanEndGte,
        limit,
      } = parsed.data;

      const viewportBounds = toViewportBounds({ north, south, east, west });
      const cutoffDate = getCutoffDate(timespanEndGte);

      if (selectedCategories?.length === 0) {
        return c.json({ messages: [] });
      }

      const locality = process.env.LOCALITY || "bg.sofia";
      const allSourceIds = getLocalitySourceIds(locality);

      const validatedSources = getValidatedSources(
        selectedSources,
        allSourceIds,
      );

      if (
        selectedSources &&
        selectedSources.length > 0 &&
        validatedSources?.length === 0
      ) {
        return c.json({ messages: [] });
      }

      const hasSourceFilter = (validatedSources?.length ?? 0) > 0;
      const hasCategoryFilter = (selectedCategories?.length ?? 0) > 0;
      const hasViewport = viewportBounds !== null;
      const effectiveLimit = clampMessagesLimit(limit);
      const queryFetchLimit = hasViewport ? undefined : effectiveLimit;
      const categoryFilters = selectedCategories ?? [];
      const sourceFilters = validatedSources ?? [];
      const useAggressiveCache = shouldApplyAggressiveCache({
        hasCategoryFilter,
        hasSourceFilter,
        hasViewport,
        zoom,
        timespanEndGte,
        limit,
      });
      const unboundCacheKey = useAggressiveCache
        ? getUnboundMessagesCacheKey(locality)
        : null;

      if (unboundCacheKey) {
        const cachedMessages = getCachedUnboundMessages(unboundCacheKey);
        if (cachedMessages) {
          c.header("Cache-Control", AGGRESSIVE_CACHE_CONTROL);
          return c.json({ messages: cachedMessages });
        }
      }

      const allMessages = await fetchMessagesForRequest({
        db,
        cutoffDate,
        categoryFilters,
        sourceFilters,
        hasCategoryFilter,
        hasSourceFilter,
        locality,
        explicitLimit: limit,
        queryFetchLimit,
      });

      let messages = filterMessagesByGeoAndViewport(
        allMessages,
        viewportBounds,
      );
      messages = simplifyMessagesForClusterZoom(messages, zoom);
      messages = sortMessagesByRelevance(messages);
      messages = messages.slice(0, effectiveLimit);

      if (useAggressiveCache) {
        c.header("Cache-Control", AGGRESSIVE_CACHE_CONTROL);
      }

      if (unboundCacheKey) {
        setCachedUnboundMessages(unboundCacheKey, messages);
      }

      return c.json({ messages });
    } catch (error) {
      console.error("Error fetching messages:", error);
      return c.json({ error: "Failed to fetch messages" }, 500);
    }
  },
);
