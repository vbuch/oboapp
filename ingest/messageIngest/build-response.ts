import {
  InternalMessage,
  Address,
  GeoJSONFeatureCollection,
} from "@/lib/types";

/**
 * Helper: Build the final message response
 * Returns InternalMessage for backend operations
 */
export async function buildMessageResponse(
  messageId: string,
  text: string,
  target: string,
  addresses: Address[],
  geoJson: GeoJSONFeatureCollection | null,
): Promise<InternalMessage> {
  return {
    id: messageId,
    text,
    target,
    addresses,
    geoJson: geoJson || undefined,
    createdAt: new Date().toISOString(),
  };
}
