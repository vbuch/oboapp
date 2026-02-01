import { Message, GeoJSONGeometry } from "@/lib/types";
import { getCentroid, createFeatureKey } from "@/lib/geometry-utils";
import { classifyMessage } from "@/lib/message-classification";
import type { MessageClassification } from "@/lib/message-classification";

/**
 * Represents a processed feature with its metadata and geometry
 */
export interface FeatureData {
  messageId: string;
  featureIndex: number;
  geometry: GeoJSONGeometry;
  properties: Record<string, unknown>;
  centroid: { lat: number; lng: number };
  classification: MessageClassification;
}

/**
 * Extract all features with centroids from an array of messages
 *
 * @param messages - Array of messages to process
 * @returns Array of FeatureData with valid centroids and classification
 */
export function extractFeaturesFromMessages(
  messages: Message[],
): FeatureData[] {
  if (!Array.isArray(messages)) {
    throw new Error("Invalid input: messages must be an array");
  }

  const features: FeatureData[] = [];

  messages.forEach((message) => {
    if (!message?.geoJson?.features) {
      return;
    }

    // Classify message once per message (not per feature)
    const classification = classifyMessage(message);

    message.geoJson.features.forEach((feature, featureIndex) => {
      if (!feature?.geometry) {
        return;
      }

      const centroid = getCentroid(feature.geometry);
      if (!centroid) {
        return;
      }

      features.push({
        messageId: message.id || "unknown",
        featureIndex,
        geometry: feature.geometry,
        properties: feature.properties || {},
        centroid,
        classification,
      });
    });
  });

  return features;
}

/**
 * Filter features to only include those marked as unclustered
 *
 * @param features - Array of features to filter
 * @param unclusteredKeys - Set of feature keys that are unclustered
 * @returns Array of features that are marked as unclustered
 */
export function filterUnclusteredFeatures(
  features: FeatureData[],
  unclusteredKeys: Set<string>,
): FeatureData[] {
  if (!Array.isArray(features)) {
    throw new Error("Invalid input: features must be an array");
  }

  if (!(unclusteredKeys instanceof Set)) {
    throw new Error("Invalid input: unclusteredKeys must be a Set");
  }

  return features.filter((feature) => {
    const key = createFeatureKey(feature.messageId, feature.featureIndex);
    return unclusteredKeys.has(key);
  });
}
