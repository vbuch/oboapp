import {
  Address,
  ExtractedLocations,
  GeoJSONFeatureCollection,
  InternalMessage,
  Coordinates,
} from "@/lib/types";
import type { FilteredMessage } from "@/lib/filter-split.schema";
import type { CadastralGeometry } from "@/lib/cadastre-geocoding-service";
import {
  createIngestErrorCollector,
  buildIngestErrorsField,
  type IngestErrorCollector,
  type IngestErrorRecorder,
} from "@/lib/ingest-errors";
import { storeIncomingMessage, updateMessage } from "./db";
import { encodeDocumentId } from "../crawlers/shared/firestore";
import { logger } from "@/lib/logger";

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
   * Whether the message applies to the entire locality (for locality-wide sources like weather warnings)
   * Locality-wide messages are hidden from the map but shown in listings
   */
  cityWide?: boolean;
  /**
   * Locality identifier (e.g., 'bg.sofia')
   * Required for all messages
   */
  locality: string;
}

export interface MessageIngestResult {
  messages: InternalMessage[];
  totalCategorized: number;
  totalRelevant: number;
  totalIrrelevant: number;
}

/**
 * Execute the full message ingest pipeline
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
  options: MessageIngestOptions,
): Promise<MessageIngestResult> {
  const hasPrecomputedGeoJson = Boolean(options.precomputedGeoJson);
  let sourceDocumentId: string | undefined;

  // Generate source document ID from URL if available
  if (options.sourceUrl) {
    sourceDocumentId = encodeDocumentId(options.sourceUrl);
  }

  // For messages with precomputed GeoJSON, create single message without AI pipeline
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

  // Use 3-step AI pipeline for messages without precomputed GeoJSON
  return await processWithAIPipeline(
    text,
    userId,
    userEmail,
    source,
    sourceDocumentId,
    options,
  );
}

/**
 * Process a single message through the geocoding pipeline (after AI steps are complete)
 */
async function processSingleMessage(
  messageId: string,
  text: string,
  precomputedGeoJson: GeoJSONFeatureCollection | null,
  options: MessageIngestOptions,
  extractedLocations: ExtractedLocations | null,
  ingestErrors: IngestErrorCollector,
): Promise<InternalMessage> {
  const crawledAt = ensureCrawledAtDate(options.crawledAt);

  // Early exit: No extracted locations and no precomputed GeoJSON
  if (!precomputedGeoJson && !extractedLocations) {
    return await finalizeFailedMessage(messageId, text, options.locality, ingestErrors);
  }

  let addresses: Address[] = [];
  let geoJson: GeoJSONFeatureCollection | null = precomputedGeoJson;

  // Handle precomputed GeoJSON path
  if (precomputedGeoJson) {
    await handlePrecomputedGeoJsonData(
      messageId,
      options.markdownText,
      options.timespanStart,
      options.timespanEnd,
      crawledAt,
    );
  }

  // Handle extracted locations path (geocoding required)
  if (extractedLocations) {
    const geocodingResult = await performGeocodingWithErrorHandling(
      messageId,
      extractedLocations,
      ingestErrors,
    );

    // Early exit: Geocoding failed
    if (!geocodingResult) {
      return await buildFinalMessageResponse(messageId, text, options.locality, addresses, null);
    }

    addresses = geocodingResult.addresses;
    geoJson = geocodingResult.geoJson;
  }

  geoJson = await applyBoundaryFilteringIfNeeded(
    messageId,
    geoJson,
    options.boundaryFilter,
  );

  await finalizeMessageWithResults(messageId, geoJson, ingestErrors);

  return await buildFinalMessageResponse(messageId, text, options.locality, addresses, geoJson);
}

/**
 * Handle messages that come with precomputed GeoJSON (skip AI pipeline)
 */
async function processPrecomputedGeoJsonMessage(
  text: string,
  userId: string,
  userEmail: string | null,
  source: string,
  sourceDocumentId: string | undefined,
  options: MessageIngestOptions,
): Promise<MessageIngestResult> {
  const storedMessageId = await storeIncomingMessage(
    text,
    userId,
    userEmail,
    source,
    options.sourceUrl,
    options.crawledAt,
    sourceDocumentId,
    options.locality,
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
    null,
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
 * 3-step AI pipeline: Filter & Split -> Categorize -> Extract Locations
 */
async function processWithAIPipeline(
  text: string,
  userId: string,
  userEmail: string | null,
  source: string,
  sourceDocumentId: string | undefined,
  options: MessageIngestOptions,
): Promise<MessageIngestResult> {
  // Import all AI service functions once before the loop
  const { filterAndSplit, categorize, extractLocations } =
    await import("../lib/ai-service");

  // Step 1: Filter & Split
  const filterResult = await filterAndSplit(text);

  if (!filterResult || filterResult.length === 0) {
    logger.error("Failed to filter & split message");
    throw new Error("Message filter & split failed");
  }

  logger.info("Filter & split complete", { count: filterResult.length });

  const messages: InternalMessage[] = [];
  let totalRelevant = 0;
  let totalIrrelevant = 0;

  for (let i = 0; i < filterResult.length; i++) {
    const filteredMessage = filterResult[i];
    const messageIndex = i + 1;

    // Use plainText from the split (per-message text)
    // Fall back to full source text only if empty (backwards compatibility)
    const messageText = filteredMessage.plainText || text;

    // Store incoming message
    const storedMessageId = await storeIncomingMessage(
      messageText,
      userId,
      userEmail,
      source,
      options.sourceUrl,
      options.crawledAt,
      sourceDocumentId,
      options.locality,
    );

    // Store filter & split result
    await storeFilteredMessage(storedMessageId, filteredMessage);

    logFilteredMessageInfo(
      filteredMessage,
      messageIndex,
      filterResult.length,
      storedMessageId,
    );

    const ingestErrors = createIngestErrorCollector();

    if (!filteredMessage.isRelevant) {
      totalIrrelevant++;
      // Use plainText for irrelevant messages, fall back to full text
      const irrelevantMessageText = filteredMessage.plainText || text;
      const message = await handleIrrelevantMessage(
        storedMessageId,
        irrelevantMessageText,
        options.locality,
        ingestErrors,
      );
      messages.push(message);
      continue;
    }

    totalRelevant++;

    // Guard: If AI says relevant but returns empty plainText, treat as error
    // This prevents downstream issues where categorize(), extractLocations(),
    // and processSingleMessage() would receive empty strings while the stored
    // message uses the fallback (messageText = filteredMessage.plainText || text).
    // Empty plainText with isRelevant=true is an AI inconsistency that should be flagged.
    if (!filteredMessage.plainText || filteredMessage.plainText.trim() === "") {
      ingestErrors.error(
        "Filter returned isRelevant=true but empty plainText (AI inconsistency)",
      );
      const message = await finalizeFailedMessage(
        storedMessageId,
        messageText,
        options.locality,
        ingestErrors,
      );
      messages.push(message);
      continue;
    }

    // Step 2: Categorize (using plainText which is now guaranteed non-empty)
    const categorizationResult = await categorize(
      filteredMessage.plainText,
      ingestErrors,
    );

    // Early exit: Categorization failed (API error or parse failure)
    if (!categorizationResult) {
      ingestErrors.error(
        "Categorization failed (API error or parse failure), finalizing without extraction",
      );
      logger.error("Categorization failed, skipping location extraction", {
        messageId: storedMessageId,
      });
      const message = await finalizeFailedMessage(
        storedMessageId,
        messageText,
        options.locality,
        ingestErrors,
      );
      messages.push(message);
      continue;
    }

    await storeCategorization(storedMessageId, categorizationResult);

    // Early exit: Zero categories -> finalize immediately
    if (categorizationResult.categories.length === 0) {
      logger.info("Message has zero categories, finalizing");
      await updateMessage(storedMessageId, {
        finalizedAt: new Date(),
        ...buildIngestErrorsField(ingestErrors),
      });
      const message = await buildFinalMessageResponse(
        storedMessageId,
        messageText,
        options.locality,
        [],
        null,
      );
      messages.push(message);
      continue;
    }

    // Step 3: Extract Locations
    const extractedLocations = await extractLocations(
      filteredMessage.plainText,
      ingestErrors,
    );

    // If extraction failed, finalize without GeoJSON
    if (!extractedLocations) {
      logger.info("Location extraction failed, finalizing without GeoJSON");
      await updateMessage(storedMessageId, {
        finalizedAt: new Date(),
        ...buildIngestErrorsField(ingestErrors),
      });
      const message = await buildFinalMessageResponse(
        storedMessageId,
        messageText,
        options.locality,
        [],
        null,
      );
      messages.push(message);
      continue;
    }

    const crawledAt = ensureCrawledAtDate(options.crawledAt);
    await storeExtractedLocations(
      storedMessageId,
      extractedLocations,
      crawledAt,
    );

    // Continue through geocoding pipeline
    const message = await processSingleMessage(
      storedMessageId,
      filteredMessage.plainText,
      null,
      options,
      extractedLocations,
      ingestErrors,
    );
    messages.push(message);
  }

  return {
    messages,
    totalCategorized: filterResult.length,
    totalRelevant,
    totalIrrelevant,
  };
}

/**
 * Log information about a filtered message being processed
 */
function logFilteredMessageInfo(
  filteredMessage: FilteredMessage,
  messageIndex: number,
  totalMessages: number,
  messageId: string | undefined,
): void {
  logger.info(`Processing message ${messageIndex}/${totalMessages}`, {
    isRelevant: filteredMessage.isRelevant,
    isInformative: filteredMessage.isInformative,
    isOneOfMany: filteredMessage.isOneOfMany,
    messageId: messageId || "auto-generated",
    responsibleEntity: filteredMessage.responsibleEntity || "",
  });
}

/**
 * Create minimal audit record for filter & split step
 */
function createFilterSplitAudit(filteredMessage: FilteredMessage) {
  return {
    step: "filterAndSplit",
    timestamp: new Date().toISOString(),
    summary: {
      isRelevant: filteredMessage.isRelevant,
      isOneOfMany: filteredMessage.isOneOfMany,
      responsibleEntity: filteredMessage.responsibleEntity || "(none)",
      textLength: filteredMessage.plainText.length,
    },
  };
}

/**
 * Create minimal audit record for categorization step
 */
function createCategorizationAudit(categories: string[]) {
  return {
    step: "categorize",
    timestamp: new Date().toISOString(),
    summary: {
      categoriesCount: categories.length,
      categories: categories,
    },
  };
}

/**
 * Create minimal audit record for location extraction step
 */
function createLocationExtractionAudit(
  extractedLocations: ExtractedLocations | null,
) {
  if (!extractedLocations) {
    return {
      step: "extractLocations",
      timestamp: new Date().toISOString(),
      summary: { success: false },
    };
  }

  return {
    step: "extractLocations",
    timestamp: new Date().toISOString(),
    summary: {
      success: true,
      pinsCount: extractedLocations.pins?.length || 0,
      streetsCount: extractedLocations.streets?.length || 0,
      cadastralCount: extractedLocations.cadastralProperties?.length || 0,
      busStopsCount: extractedLocations.busStops?.length || 0,
      cityWide: extractedLocations.cityWide || false,
    },
  };
}

/**
 * Store filter & split result (Step 1)
 */
async function storeFilteredMessage(
  messageId: string,
  filteredMessage: FilteredMessage,
): Promise<void> {
  await updateMessage(messageId, {
    plainText: filteredMessage.plainText,
    isRelevant: filteredMessage.isRelevant,
    markdownText: filteredMessage.markdownText,
    responsibleEntity: filteredMessage.responsibleEntity,
    isOneOfMany: filteredMessage.isOneOfMany,
    isInformative: filteredMessage.isInformative,
    process: [createFilterSplitAudit(filteredMessage)],
  });
}

/**
 * Store categorization result (Step 2)
 */
async function storeCategorization(
  messageId: string,
  categorizationResult: { categories: string[] },
): Promise<void> {
  const { FieldValue } = await import("firebase-admin/firestore");
  await updateMessage(messageId, {
    categories: categorizationResult.categories,
    process: FieldValue.arrayUnion(
      createCategorizationAudit(categorizationResult.categories),
    ),
  });
}

/**
 * Store extracted locations result (Step 3)
 * Denormalizes location fields to root level for Firestore queries
 */
async function storeExtractedLocations(
  messageId: string,
  extractedLocations: ExtractedLocations | null,
  crawledAt: Date,
): Promise<void> {
  const { extractTimespanRangeFromExtractedLocations, validateAndFallback } =
    await import("@/lib/timespan-utils");

  const pins = extractedLocations?.pins || [];
  const streets = extractedLocations?.streets || [];
  const cadastralProperties = extractedLocations?.cadastralProperties || [];
  const busStops = extractedLocations?.busStops || [];
  const cityWide = extractedLocations?.cityWide || false;

  // Extract timespans from extracted locations (pins/streets)
  const { timespanStart, timespanEnd } =
    extractTimespanRangeFromExtractedLocations(extractedLocations, crawledAt);

  // Validate and fallback to crawledAt if invalid
  const validated = validateAndFallback(timespanStart, timespanEnd, crawledAt);

  const { FieldValue } = await import("firebase-admin/firestore");
  await updateMessage(messageId, {
    pins,
    streets,
    cadastralProperties,
    busStops,
    cityWide,
    timespanStart: validated.timespanStart,
    timespanEnd: validated.timespanEnd,
    process: FieldValue.arrayUnion(
      createLocationExtractionAudit(extractedLocations),
    ),
  });
}

/**
 * Handle messages that are filtered as irrelevant
 */
async function handleIrrelevantMessage(
  messageId: string,
  text: string,
  locality: string,
  ingestErrors: IngestErrorCollector,
): Promise<InternalMessage> {
  logger.info("Message filtered as irrelevant, marking as finalized");
  await updateMessage(messageId, {
    finalizedAt: new Date(),
    isRelevant: false,
    ...buildIngestErrorsField(ingestErrors),
  });

  const { buildMessageResponse } = await import("./build-response");
  return await buildMessageResponse(messageId, text, locality, [], null);
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
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return new Date();
}

/**
 * Perform geocoding on extracted locations
 */
async function performGeocoding(extractedLocations: ExtractedLocations) {
  const { geocodeAddressesFromExtractedData } =
    await import("./geocode-addresses");
  return await geocodeAddressesFromExtractedData(extractedLocations);
}

/**
 * Perform geocoding with error handling for the main pipeline
 */
async function performGeocodingWithErrorHandling(
  messageId: string,
  extractedLocations: ExtractedLocations,
  ingestErrors: IngestErrorCollector,
): Promise<{
  addresses: Address[];
  geoJson: GeoJSONFeatureCollection | null;
} | null> {
  try {
    const geocodingResult = await performGeocoding(extractedLocations);
    const filteredAddresses = await filterAndStoreAddresses(
      messageId,
      geocodingResult.addresses,
      geocodingResult.preGeocodedMap,
    );

    // Identify geocoded bus stops for GeoJSON feature creation
    const geocodedBusStops =
      extractedLocations.busStops && extractedLocations.busStops.length > 0
        ? filteredAddresses.filter((addr) =>
            addr.originalText.startsWith("Спирка "),
          )
        : undefined;

    const geoJson = await convertToGeoJson(
      extractedLocations,
      geocodingResult.preGeocodedMap,
      geocodingResult.cadastralGeometries,
      geocodedBusStops,
      ingestErrors,
    );

    return { addresses: filteredAddresses, geoJson };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    ingestErrors.exception(`Ingestion exception: ${errorMessage}`);
    await finalizeMessageWithoutGeoJson(messageId, ingestErrors);
    return null;
  }
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
  // Only delete entries that were explicitly removed by the outlier filter,
  // not entries absent due to deduplication (which happens before this step)
  const beforeFilterTexts = new Set(
    geocodedAddresses.map((a) => a.originalText),
  );
  const afterFilterTexts = new Set(addresses.map((a) => a.originalText));
  for (const [key] of preGeocodedMap) {
    if (beforeFilterTexts.has(key) && !afterFilterTexts.has(key)) {
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
  extractedLocations: ExtractedLocations,
  preGeocodedMap: Map<string, Coordinates>,
  cadastralGeometries: Map<string, CadastralGeometry> | undefined,
  geocodedBusStops?: Address[],
  ingestErrors?: IngestErrorRecorder,
): Promise<GeoJSONFeatureCollection | null> {
  const { convertMessageGeocodingToGeoJson } =
    await import("./convert-to-geojson");
  return await convertMessageGeocodingToGeoJson(
    extractedLocations,
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
  locality: string,
  ingestErrors: IngestErrorCollector,
): Promise<InternalMessage> {
  ingestErrors.error(
    "Failed to extract data from message, marking as finalized",
  );
  await updateMessage(messageId, {
    finalizedAt: new Date(),
    ...buildIngestErrorsField(ingestErrors),
  });

  const { buildMessageResponse } = await import("./build-response");
  return await buildMessageResponse(messageId, text, locality, [], null);
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
): Promise<void> {
  if (!markdownText) {
    return;
  }

  const { validateAndFallback } = await import("@/lib/timespan-utils");
  const validated = validateAndFallback(timespanStart, timespanEnd, crawledAt);

  await updateMessage(messageId, {
    markdownText,
    responsibleEntity: "",
    pins: [],
    streets: [],
    cadastralProperties: [],
    timespanStart: validated.timespanStart,
    timespanEnd: validated.timespanEnd,
  });
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
  if (!geoJson) {
    await finalizeMessageWithoutGeoJson(messageId, ingestErrors);
    return;
  }

  await updateMessage(messageId, {
    geoJson,
    finalizedAt: new Date(),
    ...buildIngestErrorsField(ingestErrors),
  });
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
  locality: string,
  addresses: Address[],
  geoJson: GeoJSONFeatureCollection | null,
): Promise<InternalMessage> {
  const { buildMessageResponse } = await import("./build-response");
  return await buildMessageResponse(messageId, text, locality, addresses, geoJson);
}
