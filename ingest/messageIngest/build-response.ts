import {
  Message,
  Address,
  ExtractedData,
  GeoJSONFeatureCollection,
} from "@/lib/types";

/**
 * Helper: Build the final message response
 */
export async function buildMessageResponse(
  messageId: string,
  text: string,
  addresses: Address[],
  extractedData: ExtractedData | null,
  geoJson: GeoJSONFeatureCollection | null,
  failureReason?: string
): Promise<Message> {
  return {
    id: messageId,
    text,
    addresses,
    extractedData: extractedData || undefined,
    geoJson: geoJson || undefined,
    createdAt: new Date().toISOString(),
    failureReason,
  };
}
