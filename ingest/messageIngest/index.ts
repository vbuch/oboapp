import {
  Address,
  ExtractedData,
  GeoJSONFeatureCollection,
  Message,
} from "@/lib/types";
import { storeIncomingMessage, updateMessage } from "./db";
import { encodeDocumentId } from "../crawlers/shared/firestore";

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
}

export interface MessageIngestResult {
  messages: Message[];
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
  options: MessageIngestOptions = {}
): Promise<MessageIngestResult> {
  const hasPrecomputedGeoJson = Boolean(options.precomputedGeoJson);
  let sourceDocumentId: string | undefined;

  // Generate source document ID from URL if available
  if (options.sourceUrl) {
    sourceDocumentId = encodeDocumentId(options.sourceUrl);
  }

  // For messages with precomputed GeoJSON, create single message without categorization
  if (hasPrecomputedGeoJson) {
    const messageId = sourceDocumentId ? `${sourceDocumentId}-1` : undefined; // Let Firestore auto-generate for web interface

    const storedMessageId = await storeIncomingMessage(
      text,
      userId,
      userEmail,
      source,
      options.sourceUrl,
      options.crawledAt,
      messageId,
      sourceDocumentId
    );

    const message = await processSingleMessage(
      storedMessageId,
      text,
      options.precomputedGeoJson || null,
      options
    );

    return {
      messages: [message],
      totalCategorized: 1,
      totalRelevant: 1,
      totalIrrelevant: 0,
    };
  }

  // Use categorize for messages without precomputed GeoJSON
  const { categorize } = await import("../lib/ai-service");
  const categorizedMessages = await categorize(text);

  if (!categorizedMessages || categorizedMessages.length === 0) {
    console.error("❌ Failed to categorize message");
    throw new Error("Message categorization failed");
  }

  const messages: Message[] = [];
  let totalRelevant = 0;
  let totalIrrelevant = 0;

  console.log(`📊 Categorized into ${categorizedMessages.length} message(s)`);

  for (let i = 0; i < categorizedMessages.length; i++) {
    const categorizedMessage = categorizedMessages[i];
    const messageIndex = i + 1;

    // Generate deterministic message ID
    const messageId = sourceDocumentId
      ? `${sourceDocumentId}-${messageIndex}`
      : undefined; // Let Firestore auto-generate for web interface

    console.log(
      `\n📄 Processing message ${messageIndex}/${categorizedMessages.length}`
    );
    console.log(`   Categories: ${categorizedMessage.categories.join(", ")}`);
    console.log(`   Relevant: ${categorizedMessage.isRelevant}`);
    console.log(`   Message ID: ${messageId || "auto-generated"}`);

    // Store the categorized message
    const storedMessageId = await storeIncomingMessage(
      categorizedMessage.normalizedText,
      userId,
      userEmail,
      source,
      options.sourceUrl,
      options.crawledAt,
      messageId,
      sourceDocumentId
    );

    // Store categorization result
    await updateMessage(storedMessageId, {
      categorize: categorizedMessage,
    });

    if (categorizedMessage.isRelevant) {
      totalRelevant++;
      const message = await processSingleMessage(
        storedMessageId,
        categorizedMessage.normalizedText,
        null,
        options,
        categorizedMessage
      );
      messages.push(message);
    } else {
      totalIrrelevant++;
      console.log("ℹ️  Message filtered as irrelevant, marking as finalized");
      await updateMessage(storedMessageId, { finalizedAt: new Date() });

      const { buildMessageResponse } = await import("./build-response");
      const message = await buildMessageResponse(
        storedMessageId,
        categorizedMessage.normalizedText,
        [],
        null,
        null
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
 * Process a single message through the geocoding pipeline
 */
async function processSingleMessage(
  messageId: string,
  text: string,
  precomputedGeoJson: GeoJSONFeatureCollection | null,
  options: MessageIngestOptions,
  categorizedMessage?: any
): Promise<Message> {
  let extractedData: ExtractedData | null = null;
  let addresses: Address[] = [];
  let geoJson: GeoJSONFeatureCollection | null = precomputedGeoJson;

  if (!precomputedGeoJson) {
    // Extract structured data from text
    const { extractAddressesFromMessage } = await import("./extract-addresses");
    extractedData = await extractAddressesFromMessage(text);

    // Store extracted data and markdown text together
    const markdownText = extractedData?.markdown_text || "";
    await updateMessage(messageId, {
      extractedData,
      markdownText,
    });

    // If extraction failed, finalize and return
    if (!extractedData) {
      console.error(
        "❌ Failed to extract data from message, marking as finalized"
      );
      await updateMessage(messageId, { finalizedAt: new Date() });

      const { buildMessageResponse } = await import("./build-response");
      return await buildMessageResponse(messageId, text, [], null, null);
    }

    // Geocode addresses
    const { geocodeAddressesFromExtractedData } = await import(
      "./geocode-addresses"
    );
    const {
      preGeocodedMap,
      addresses: geocodedAddresses,
      cadastralGeometries,
    } = await geocodeAddressesFromExtractedData(extractedData);

    // Filter outlier coordinates
    const { filterOutlierCoordinates } = await import("./filter-outliers");
    addresses = filterOutlierCoordinates(geocodedAddresses);

    // Update preGeocodedMap to remove filtered outliers
    const filteredOriginalTexts = new Set(addresses.map((a) => a.originalText));
    for (const [key] of preGeocodedMap) {
      if (!filteredOriginalTexts.has(key)) {
        preGeocodedMap.delete(key);
      }
    }

    // Store geocoding results in message
    if (addresses.length > 0) {
      await updateMessage(messageId, { addresses });
    }

    // Convert to GeoJSON
    const { convertMessageGeocodingToGeoJson } = await import(
      "./convert-to-geojson"
    );
    geoJson = await convertMessageGeocodingToGeoJson(
      extractedData,
      preGeocodedMap,
      cadastralGeometries
    );
  } else if (options.markdownText) {
    // When using precomputed GeoJSON, store markdown_text if provided
    extractedData = {
      responsible_entity: "",
      pins: [],
      streets: [],
      markdown_text: options.markdownText,
    };
    await updateMessage(messageId, {
      markdownText: options.markdownText,
      extractedData,
    });
  }

  // Apply boundary filtering if provided
  if (options.boundaryFilter && geoJson) {
    const { filterFeaturesByBoundaries } = await import(
      "../lib/boundary-utils"
    );
    const filteredGeoJson = filterFeaturesByBoundaries(
      geoJson,
      options.boundaryFilter
    );

    if (!filteredGeoJson) {
      // No features within boundaries, don't store the message
      console.log(
        `⏭️  Message ${messageId} has no features within boundaries, skipping storage`
      );
      // Note: The message document already exists in Firestore from storeIncomingMessage
      // We could delete it here, but leaving it allows for auditing
      throw new Error("No features within specified boundaries");
    }

    geoJson = filteredGeoJson;
  }

  // Store GeoJSON and finalize message
  if (geoJson) {
    await updateMessage(messageId, { geoJson, finalizedAt: new Date() });
  }

  // Build and return response
  const { buildMessageResponse } = await import("./build-response");
  return await buildMessageResponse(
    messageId,
    text,
    addresses,
    extractedData,
    geoJson
  );
}
