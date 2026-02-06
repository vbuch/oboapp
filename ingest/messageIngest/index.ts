import {
  Address,
  ExtractedData,
  GeoJSONFeatureCollection,
  InternalMessage,
  Coordinates,
} from "@/lib/types";
import type { CategorizedMessage } from "@/lib/categorize.schema";
import type { CadastralGeometry } from "@/lib/cadastre-geocoding-service";
import {
  createIngestErrorCollector,
  buildIngestErrorsField,
  type IngestErrorCollector,
  type IngestErrorRecorder,
} from "@/lib/ingest-errors";
import { storeIncomingMessage, updateMessage } from "./db";
import { encodeDocumentId } from "../crawlers/shared/firestore";
import { generateMessageId, formatCategorizedMessageLogInfo } from "./utils";
import { logger } from "@/lib/logger";

export { extractAddressesFromMessage } from "./extract-addresses";
export {
  geocodeAddressesFromExtractedData,
  type GeocodingResult,
} from "./geocode-addresses";
export { convertMessageGeocodingToGeoJson } from "./convert-to-geojson";
export { filterOutlierCoordinates } from "./filter-outliers";
export { verifyAuthToken, validateMessageText } from "./helpers";
export { buildMessageResponse } from "./build-response";

export interface MessageIngestOptions {
  /**
   * Provide ready GeoJSON geometry to skip AI extraction + geocoding.
   * Used by crawlers or integrations with pre-geocoded data.
   */
  precomputedGeoJson?: GeoJSONFeatureCollection | null;
  /**
   * Optional source URL for the message (e.g., original article URL)
   */
  sourceUrl?: string;
  /**
   * Optional boundary filtering - if provided, only features within boundaries are kept
   * If no features are within boundaries, the message is not stored
   */
  boundaryFilter?: GeoJSONFeatureCollection;
  /**
   * Optional crawledAt timestamp from the source document
   */
  crawledAt?: Date;
  /**
   * Optional markdown-formatted text for display (when crawler produces markdown)
   */
  markdownText?: string;
  /**
   * Optional timespan start from source (for precomputed GeoJSON crawlers)
   */
  timespanStart?: Date;
  /**
   * Optional timespan end from source (for precomputed GeoJSON crawlers)
   */
  timespanEnd?: Date;
  /**
   * Categories for sources with precomputed GeoJSON (for Firestore indexing)
   */
  categories?: string[];
  /**
   * Whether the source is relevant (for precomputed GeoJSON sources)
   */
  isRelevant?: boolean;
  /**
   * Whether the message applies to the entire city (for city-wide sources like weather warnings)
   * City-wide messages are hidden from the map but shown in listings
   */
  cityWide?: boolean;
}

export interface MessageIngestResult {
  messages: InternalMessage[];
  totalCategorized: number;
  totalRelevant: number;
  totalIrrelevant: number;
}

/**
 * Execute the full message ingest pipeline with categorization support
 * @param text - The message text to process
 * @param source - The source of the message (e.g., 'web-interface', 'api', etc.)
 * @param userId - The ID of the user creating the message
 * @param userEmail - The email of the user creating the message (can be null)
 * @returns Array of processed messages with geocoding and GeoJSON data
 */
export async function messageIngest(
  text: string,
  source: string,
  userId: string,
  userEmail: string | null,
  options: MessageIngestOptions = {},
): Promise<MessageIngestResult> {
  const hasPrecomputedGeoJson = Boolean(options.precomputedGeoJson);
  let sourceDocumentId: string | undefined;

  // Generate source document ID from URL if available
  if (options.sourceUrl) {
    sourceDocumentId = encodeDocumentId(options.sourceUrl);
  }

  // For messages with precomputed GeoJSON, create single message without categorization
  if (hasPrecomputedGeoJson) {
    return await processPrecomputedGeoJsonMessage(
      text,
      userId,
      userEmail,
      source,
      sourceDocumentId,
      options,
    );
  }

  // Use categorize for messages without precomputed GeoJSON
  return await processCategorizedMessages(
    text,
    userId,
    userEmail,
    source,
    sourceDocumentId,
    options,
  );
}

/**
 * Process a single message through the geocoding pipeline
 */
async function processSingleMessage(
  messageId: string,
  text: string,
  precomputedGeoJson: GeoJSONFeatureCollection | null,
  options: MessageIngestOptions,
  categorizedMessage: CategorizedMessage | undefined,
  ingestErrors: IngestErrorCollector,
): Promise<InternalMessage> {
  let extractedData: ExtractedData | null = null;
  let addresses: Address[] = [];
  let geoJson: GeoJSONFeatureCollection | null = precomputedGeoJson;

  // Calculate crawledAt once for use in both branches
  const crawledAt = ensureCrawledAtDate(options.crawledAt);

  if (precomputedGeoJson) {
    extractedData = await handlePrecomputedGeoJsonData(
      messageId,
      options.markdownText,
      options.timespanStart,
      options.timespanEnd,
      crawledAt,
    );
  } else {
    try {
      const extractionResult = await extractAndGeocodeFromText(
        messageId,
        text,
        categorizedMessage,
        crawledAt,
        ingestErrors,
      );

      if (!extractionResult) {
        return await finalizeFailedMessage(messageId, text, ingestErrors);
      }

      extractedData = extractionResult.extractedData;
      addresses = extractionResult.addresses;
      geoJson = extractionResult.geoJson;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      ingestErrors.exception(`Ingestion exception: ${errorMessage}`);
      await finalizeMessageWithoutGeoJson(messageId, ingestErrors);
      return await buildFinalMessageResponse(
        messageId,
        text,
        addresses,
        extractedData,
        null,
      );
    }
  }

  geoJson = await applyBoundaryFilteringIfNeeded(
    messageId,
    geoJson,
    options.boundaryFilter,
  );

  await finalizeMessageWithResults(messageId, geoJson, ingestErrors);

  return await buildFinalMessageResponse(
    messageId,
    text,
    addresses,
    extractedData,
    geoJson,
  );
}
/**
 * Handle messages that come with precomputed GeoJSON (skip categorization)
 */
async function processPrecomputedGeoJsonMessage(
  text: string,
  userId: string,
  userEmail: string | null,
  source: string,
  sourceDocumentId: string | undefined,
  options: MessageIngestOptions,
): Promise<MessageIngestResult> {
  const messageId = sourceDocumentId ? `${sourceDocumentId}-1` : undefined;

  const storedMessageId = await storeIncomingMessage(
    text,
    userId,
    userEmail,
    source,
    options.sourceUrl,
    options.crawledAt,
    messageId,
    sourceDocumentId,
  );

  // Store categories and isRelevant for precomputed GeoJSON sources (for Firestore indexes)
  if (options.categories && options.isRelevant !== undefined) {
    await updateMessage(storedMessageId, {
      categories: options.categories,
      isRelevant: options.isRelevant,
      ...(options.cityWide !== undefined && { cityWide: options.cityWide }),
    });
  }

  const message = await processSingleMessage(
    storedMessageId,
    text,
    options.precomputedGeoJson || null,
    options,
    undefined,
    createIngestErrorCollector(),
  );

  return {
    messages: [message],
    totalCategorized: 1,
    totalRelevant: 1,
    totalIrrelevant: 0,
  };
}

/**
 * Handle messages that need categorization via AI service
 */
async function processCategorizedMessages(
  text: string,
  userId: string,
  userEmail: string | null,
  source: string,
  sourceDocumentId: string | undefined,
  options: MessageIngestOptions,
): Promise<MessageIngestResult> {
  const { categorize } = await import("../lib/ai-service");
  const categorizedMessages = await categorize(text);

  if (!categorizedMessages || categorizedMessages.length === 0) {
    logger.error("Failed to categorize message");
    throw new Error("Message categorization failed");
  }

  logger.info("Categorized message", { count: categorizedMessages.length });

  const messages: InternalMessage[] = [];
  let totalRelevant = 0;
  let totalIrrelevant = 0;

  for (let i = 0; i < categorizedMessages.length; i++) {
    const categorizedMessage = categorizedMessages[i];
    const messageIndex = i + 1;
    const messageId = generateMessageId(sourceDocumentId, messageIndex);

    logCategorizedMessageInfo(
      categorizedMessage,
      messageIndex,
      categorizedMessages.length,
      messageId,
    );

    const storedMessageId = await storeCategorizedMessage(
      categorizedMessage,
      userId,
      userEmail,
      source,
      messageId,
      sourceDocumentId,
      options,
    );

    const ingestErrors = createIngestErrorCollector();

    if (categorizedMessage.isRelevant) {
      totalRelevant++;
      const message = await processSingleMessage(
        storedMessageId,
        categorizedMessage.normalizedText,
        null,
        options,
        categorizedMessage,
        ingestErrors,
      );
      messages.push(message);
    } else {
      totalIrrelevant++;
      const message = await handleIrrelevantMessage(
        storedMessageId,
        categorizedMessage.normalizedText,
        ingestErrors,
      );
      messages.push(message);
    }
  }

  return {
    messages,
    totalCategorized: categorizedMessages.length,
    totalRelevant,
    totalIrrelevant,
  };
}

/**
 * Log information about a categorized message being processed
 */
function logCategorizedMessageInfo(
  categorizedMessage: CategorizedMessage,
  messageIndex: number,
  totalMessages: number,
  messageId: string | undefined,
): void {
  const logMessages = formatCategorizedMessageLogInfo(
    categorizedMessage,
    messageIndex,
    totalMessages,
    messageId,
  );
  logMessages.forEach((message) => logger.info(message));
}

/**
 * Store a categorized message with its categorization result
 */
async function storeCategorizedMessage(
  categorizedMessage: CategorizedMessage,
  userId: string,
  userEmail: string | null,
  source: string,
  messageId: string | undefined,
  sourceDocumentId: string | undefined,
  options: MessageIngestOptions,
): Promise<string> {
  const storedMessageId = await storeIncomingMessage(
    categorizedMessage.normalizedText,
    userId,
    userEmail,
    source,
    options.sourceUrl,
    options.crawledAt,
    messageId,
    sourceDocumentId,
  );

  // Store categorization data - both nested object and flattened fields for Firestore indexes
  await updateMessage(storedMessageId, {
    categorize: categorizedMessage,
    // Flatten fields to root level for Firestore index queries
    categories: categorizedMessage.categories,
    isRelevant: categorizedMessage.isRelevant,
    // Denormalize busStops for public API exposure
    busStops: categorizedMessage.busStops,
  });

  return storedMessageId;
}

/**
 * Handle messages that are categorized as irrelevant
 */
async function handleIrrelevantMessage(
  messageId: string,
  text: string,
  ingestErrors: IngestErrorCollector,
): Promise<InternalMessage> {
  logger.info("Message filtered as irrelevant, marking as finalized");
  await updateMessage(messageId, {
    finalizedAt: new Date(),
    isRelevant: false,
    ...buildIngestErrorsField(ingestErrors),
  });

  const { buildMessageResponse } = await import("./build-response");
  return await buildMessageResponse(messageId, text, [], null, null);
}

/**
 * Extract data from text and perform geocoding
 */
async function extractAndGeocodeFromText(
  messageId: string,
  text: string,
  categorizedMessage: CategorizedMessage | undefined,
  crawledAt: Date,
  ingestErrors: IngestErrorRecorder,
): Promise<{
  extractedData: ExtractedData;
  addresses: Address[];
  geoJson: GeoJSONFeatureCollection | null;
} | null> {
  const { extractAddressesFromMessage } = await import("./extract-addresses");
  const extractedData = await extractAddressesFromMessage(text, ingestErrors);

  await storeExtractedData(messageId, extractedData, crawledAt);

  if (!extractedData) {
    return null;
  }

  const geocodingResults = await performGeocoding(
    extractedData,
    categorizedMessage,
  );
  const addresses = await filterAndStoreAddresses(
    messageId,
    geocodingResults.addresses,
    geocodingResults.preGeocodedMap,
  );

  // Extract geocoded bus stops for GeoJSON conversion
  const geocodedBusStops =
    categorizedMessage?.busStops && categorizedMessage.busStops.length > 0
      ? addresses.filter((addr) => addr.originalText.startsWith("Спирка "))
      : undefined;

  const geoJson = await convertToGeoJson(
    extractedData,
    geocodingResults.preGeocodedMap,
    geocodingResults.cadastralGeometries,
    geocodedBusStops,
    ingestErrors,
  );

  return { extractedData, addresses, geoJson };
}

/**
 * Convert crawledAt to Date object, handling string/Date/undefined cases
 * Falls back to current date for invalid/missing values
 */
function ensureCrawledAtDate(crawledAt: Date | string | undefined): Date {
  if (crawledAt instanceof Date) {
    return crawledAt;
  }
  if (crawledAt) {
    const date = new Date(crawledAt);
    // Check if date is valid (Invalid Date has NaN getTime())
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return new Date();
}

/**
 * Store extracted data and markdown text in the message
 * Denormalizes extractedData fields for public API exposure
 */
async function storeExtractedData(
  messageId: string,
  extractedData: ExtractedData | null,
  crawledAt: Date,
): Promise<void> {
  const { extractTimespanRangeFromExtractedData, validateAndFallback } =
    await import("@/lib/timespan-utils");

  const markdownText = extractedData?.markdown_text || "";
  const responsibleEntity = extractedData?.responsible_entity || "";
  const pins = extractedData?.pins || [];
  const streets = extractedData?.streets || [];
  const cadastralProperties = extractedData?.cadastralProperties || [];

  // Extract timespans from extractedData (pins/streets)
  const { timespanStart, timespanEnd } = extractTimespanRangeFromExtractedData(
    extractedData,
    crawledAt,
  );

  // Validate and fallback to crawledAt if invalid
  const validated = validateAndFallback(timespanStart, timespanEnd, crawledAt);

  await updateMessage(messageId, {
    extractedData,
    // Denormalize fields for public API exposure
    markdownText,
    responsibleEntity,
    pins,
    streets,
    cadastralProperties,
    timespanStart: validated.timespanStart,
    timespanEnd: validated.timespanEnd,
  });
}

/**
 * Perform geocoding on extracted data
 */
async function performGeocoding(
  extractedData: ExtractedData,
  categorizedMessage?: CategorizedMessage,
) {
  const { geocodeAddressesFromExtractedData } =
    await import("./geocode-addresses");
  return await geocodeAddressesFromExtractedData(
    extractedData,
    categorizedMessage,
  );
}

/**
 * Filter outliers and store valid addresses
 */
async function filterAndStoreAddresses(
  messageId: string,
  geocodedAddresses: Address[],
  preGeocodedMap: Map<string, Coordinates>,
): Promise<Address[]> {
  const { filterOutlierCoordinates } = await import("./filter-outliers");
  const addresses = filterOutlierCoordinates(geocodedAddresses);

  // Update preGeocodedMap to remove filtered outliers
  const filteredOriginalTexts = new Set(addresses.map((a) => a.originalText));
  for (const [key] of preGeocodedMap) {
    if (!filteredOriginalTexts.has(key)) {
      preGeocodedMap.delete(key);
    }
  }

  if (addresses.length > 0) {
    await updateMessage(messageId, { addresses });
  }

  return addresses;
}

/**
 * Convert geocoding results to GeoJSON format
 */
async function convertToGeoJson(
  extractedData: ExtractedData,
  preGeocodedMap: Map<string, Coordinates>,
  cadastralGeometries: Map<string, CadastralGeometry> | undefined,
  geocodedBusStops?: Address[],
  ingestErrors?: IngestErrorRecorder,
): Promise<GeoJSONFeatureCollection | null> {
  const { convertMessageGeocodingToGeoJson } =
    await import("./convert-to-geojson");
  return await convertMessageGeocodingToGeoJson(
    extractedData,
    preGeocodedMap,
    cadastralGeometries,
    geocodedBusStops,
    ingestErrors,
  );
}

/**
 * Finalize a message that failed extraction
 */
async function finalizeFailedMessage(
  messageId: string,
  text: string,
  ingestErrors: IngestErrorCollector,
): Promise<InternalMessage> {
  ingestErrors.error(
    "❌ Failed to extract data from message, marking as finalized",
  );
  await updateMessage(messageId, {
    finalizedAt: new Date(),
    ...buildIngestErrorsField(ingestErrors),
  });

  const { buildMessageResponse } = await import("./build-response");
  return await buildMessageResponse(messageId, text, [], null, null);
}

/**
 * Handle precomputed GeoJSON data storage
 */
async function handlePrecomputedGeoJsonData(
  messageId: string,
  markdownText: string | undefined,
  timespanStart: Date | undefined,
  timespanEnd: Date | undefined,
  crawledAt: Date,
): Promise<ExtractedData | null> {
  const { validateAndFallback } = await import("@/lib/timespan-utils");

  if (markdownText) {
    const extractedData: ExtractedData = {
      responsible_entity: "",
      pins: [],
      streets: [],
      markdown_text: markdownText,
    };

    // Validate timespans from source
    const validated = validateAndFallback(
      timespanStart,
      timespanEnd,
      crawledAt,
    );

    await updateMessage(messageId, {
      extractedData,
      // Denormalize fields for public API exposure
      markdownText,
      responsibleEntity: "",
      pins: [],
      streets: [],
      cadastralProperties: [],
      timespanStart: validated.timespanStart,
      timespanEnd: validated.timespanEnd,
    });

    return extractedData;
  }

  return null;
}

/**
 * Apply boundary filtering to GeoJSON if boundary filter is provided
 */
async function applyBoundaryFilteringIfNeeded(
  messageId: string,
  geoJson: GeoJSONFeatureCollection | null,
  boundaryFilter: GeoJSONFeatureCollection | undefined,
): Promise<GeoJSONFeatureCollection | null> {
  if (!boundaryFilter || !geoJson) {
    return geoJson;
  }

  const { filterFeaturesByBoundaries } = await import("../lib/boundary-utils");
  const filteredGeoJson = filterFeaturesByBoundaries(geoJson, boundaryFilter);

  if (!filteredGeoJson) {
    logger.info("Message has no features within boundaries, skipping storage", {
      messageId,
    });
    throw new Error("No features within specified boundaries");
  }

  return filteredGeoJson;
}

/**
 * Finalize message by storing GeoJSON and setting finalized timestamp
 */
async function finalizeMessageWithResults(
  messageId: string,
  geoJson: GeoJSONFeatureCollection | null,
  ingestErrors: IngestErrorCollector,
): Promise<void> {
  if (geoJson) {
    await updateMessage(messageId, {
      geoJson,
      finalizedAt: new Date(),
      ...buildIngestErrorsField(ingestErrors),
    });
  }
}

async function finalizeMessageWithoutGeoJson(
  messageId: string,
  ingestErrors: IngestErrorCollector,
): Promise<void> {
  await updateMessage(messageId, {
    finalizedAt: new Date(),
    ...buildIngestErrorsField(ingestErrors),
  });
}

/**
 * Build the final message response
 */
async function buildFinalMessageResponse(
  messageId: string,
  text: string,
  addresses: Address[],
  extractedData: ExtractedData | null,
  geoJson: GeoJSONFeatureCollection | null,
): Promise<InternalMessage> {
  const { buildMessageResponse } = await import("./build-response");
  return await buildMessageResponse(
    messageId,
    text,
    addresses,
    extractedData,
    geoJson,
  );
}
