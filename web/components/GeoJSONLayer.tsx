"use client";

import React, { useEffect, useState, useRef } from "react";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { trackEvent } from "@/lib/analytics";
import { Message } from "@/lib/types";
import {
  createFeatureKey,
  jitterDuplicatePositions,
} from "@/lib/geometry-utils";
import { extractFeaturesFromMessages, FeatureData } from "@/lib/feature-utils";
import { createMarkerIcon, createClusterIcon } from "@/lib/marker-config";
import GeometryRenderer from "./GeometryRenderer";

// Extend google.maps.Marker with custom feature data
interface ExtendedMarker extends google.maps.Marker {
  featureData?: FeatureData;
  featureKey?: string;
  classification?: "active" | "archived";
}

interface GeoJSONLayerProps {
  readonly messages: Message[];
  readonly onFeatureClick?: (_messageId: string) => void;
  readonly map?: google.maps.Map | null;
  readonly currentZoom: number;
}

export default function GeoJSONLayer({
  messages,
  onFeatureClick,
  map,
  currentZoom,
}: GeoJSONLayerProps) {
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);
  const [unclusteredActiveFeatures, setUnclusteredActiveFeatures] = useState<
    Set<string>
  >(new Set());
  const [unclusteredArchivedFeatures, setUnclusteredArchivedFeatures] =
    useState<Set<string>>(new Set());

  // Separate refs for each clusterer
  const activeClustererRef = useRef<MarkerClusterer | null>(null);
  const archivedClustererRef = useRef<MarkerClusterer | null>(null);
  const activeMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const archivedMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());

  // Extract all features with centroids and classification
  const features = extractFeaturesFromMessages(messages);

  // Split features by classification
  const activeFeatures = features.filter((f) => f.classification === "active");
  const archivedFeatures = features.filter(
    (f) => f.classification === "archived",
  );

  /**
   * Helper function to create markers for a list of features
   */
  const createMarkersForFeatures = (
    featuresList: FeatureData[],
    classification: "active" | "archived",
    markerMap: Map<string, google.maps.Marker>,
  ): google.maps.Marker[] => {
    const markers: google.maps.Marker[] = [];

    // Apply jittering to prevent overlapping markers at identical positions
    const jitteredCentroids = jitterDuplicatePositions(
      featuresList.map((f) => f.centroid),
    );

    featuresList.forEach((feature, index) => {
      const key = createFeatureKey(feature.messageId, feature.featureIndex);

      const marker = new google.maps.Marker({
        position: jitteredCentroids[index], // Use jittered position
        map: null, // Will be managed by clusterer
        icon: createMarkerIcon(false, classification),
        title:
          (feature.properties?.["address"] as string | undefined) ||
          (feature.properties?.["street_name"] as string | undefined) ||
          "Маркер",
        zIndex: classification === "active" ? 10 : 5, // Active markers higher
      });

      // Store feature data in marker
      (marker as ExtendedMarker).featureData = feature;
      (marker as ExtendedMarker).featureKey = key;
      (marker as ExtendedMarker).classification = classification;

      // Click handler
      marker.addListener("click", () => {
        setSelectedFeature(key);
        if (onFeatureClick) {
          trackEvent({
            name: "map_feature_clicked",
            params: {
              message_id: feature.messageId,
              geometry_type: feature.geometry.type,
              classification: classification,
            },
          });
          onFeatureClick(feature.messageId);
        }
      });

      // Hover handlers
      marker.addListener("mouseover", () => {
        setHoveredFeature(key);
        marker.setIcon(createMarkerIcon(true, classification));
      });

      marker.addListener("mouseout", () => {
        setHoveredFeature(null);
        marker.setIcon(createMarkerIcon(false, classification));
      });

      markers.push(marker);
      markerMap.set(key, marker);
    });

    return markers;
  };

  // Create and manage markers with clustering
  useEffect(() => {
    if (!map) return;

    // Clear existing markers and clusterers
    activeMarkersRef.current.forEach((marker) => marker.setMap(null));
    archivedMarkersRef.current.forEach((marker) => marker.setMap(null));
    activeMarkersRef.current.clear();
    archivedMarkersRef.current.clear();
    if (activeClustererRef.current) {
      activeClustererRef.current.clearMarkers();
    }
    if (archivedClustererRef.current) {
      archivedClustererRef.current.clearMarkers();
    }

    // Create archived markers first (will be rendered below)
    const archivedMarkers = createMarkersForFeatures(
      archivedFeatures,
      "archived",
      archivedMarkersRef.current,
    );

    // Create active markers second (will be rendered above)
    const activeMarkers = createMarkersForFeatures(
      activeFeatures,
      "active",
      activeMarkersRef.current,
    );

    // Create archived clusterer FIRST (lower z-index)
    if (archivedMarkers.length > 0) {
      const archivedClusterer = new MarkerClusterer({
        map: map,
        markers: archivedMarkers,
        algorithmOptions: {
          maxZoom: 17, // Cluster until zoom level 17
        },
        renderer: {
          render: ({ count, position, markers: clusterMarkers }) => {
            // Track which markers are in this cluster
            if (count > 1) {
              clusterMarkers?.forEach((marker) => {
                const key = (marker as ExtendedMarker).featureKey;
                if (key) {
                  setUnclusteredArchivedFeatures((prev) => {
                    const next = new Set(prev);
                    next.delete(key);
                    return next;
                  });
                }
              });
            }

            // Create grey cluster marker
            const { icon, label } = createClusterIcon(count, "archived");
            const clusterMarker = new google.maps.Marker({
              position,
              icon,
              label,
              zIndex: 1 + count, // Lower z-index: below all pins but above geometry
            });

            // Add click handler for analytics and zoom
            clusterMarker.addListener("click", () => {
              trackEvent({
                name: "map_cluster_clicked",
                params: {
                  classification: "archived",
                },
              });
              if (map) {
                map.setZoom((map.getZoom() || 0) + 1);
              }
            });

            return clusterMarker;
          },
        },
      });

      archivedClustererRef.current = archivedClusterer;

      // Initialize all archived features as unclustered
      const allArchivedKeys = new Set(archivedMarkersRef.current.keys());
      setUnclusteredArchivedFeatures(allArchivedKeys);
    }

    // Create active clusterer SECOND (higher z-index)
    if (activeMarkers.length > 0) {
      const activeClusterer = new MarkerClusterer({
        map: map,
        markers: activeMarkers,
        algorithmOptions: {
          maxZoom: 17, // Cluster until zoom level 17
        },
        renderer: {
          render: ({ count, position, markers: clusterMarkers }) => {
            // Track which markers are in this cluster
            if (count > 1) {
              clusterMarkers?.forEach((marker) => {
                const key = (marker as ExtendedMarker).featureKey;
                if (key) {
                  setUnclusteredActiveFeatures((prev) => {
                    const next = new Set(prev);
                    next.delete(key);
                    return next;
                  });
                }
              });
            }

            // Create red cluster marker
            const { icon, label } = createClusterIcon(count, "active");
            const clusterMarker = new google.maps.Marker({
              position,
              icon,
              label,
              zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count, // Higher base z-index
            });

            // Add click handler for analytics and zoom
            clusterMarker.addListener("click", () => {
              trackEvent({
                name: "map_cluster_clicked",
                params: {
                  classification: "active",
                },
              });
              map.setZoom((map.getZoom() || 0) + 1);
            });

            // Add click handler for analytics and zoom
            clusterMarker.addListener("click", () => {
              trackEvent({
                name: "map_cluster_clicked",
                params: {
                  classification: "active",
                },
              });
              if (map) {
                map.setZoom((map.getZoom() || 0) + 1);
              }
            });

            return clusterMarker;
          },
        },
      });

      activeClustererRef.current = activeClusterer;

      // Initialize all active features as unclustered
      const allActiveKeys = new Set(activeMarkersRef.current.keys());
      setUnclusteredActiveFeatures(allActiveKeys);
    }

    // Listen to map zoom/bounds changes to update unclustered state
    const updateUnclusteredState = () => {
      setTimeout(() => {
        const allActiveKeys = new Set(activeMarkersRef.current.keys());
        const allArchivedKeys = new Set(archivedMarkersRef.current.keys());
        setUnclusteredActiveFeatures(allActiveKeys);
        setUnclusteredArchivedFeatures(allArchivedKeys);
      }, 100); // Small delay to let clusterer finish rendering
    };

    map.addListener("zoom_changed", updateUnclusteredState);
    map.addListener("bounds_changed", updateUnclusteredState);

    // Capture ref values for cleanup to avoid stale closures
    const currentActiveMarkers = activeMarkersRef.current;
    const currentArchivedMarkers = archivedMarkersRef.current;
    const activeClusterer = activeClustererRef.current;
    const archivedClusterer = archivedClustererRef.current;

    return () => {
      // Cleanup
      currentActiveMarkers.forEach((marker) => marker.setMap(null));
      currentArchivedMarkers.forEach((marker) => marker.setMap(null));
      currentActiveMarkers.clear();
      currentArchivedMarkers.clear();
      if (activeClusterer) {
        activeClusterer.clearMarkers();
        activeClustererRef.current = null;
      }
      if (archivedClusterer) {
        archivedClusterer.clearMarkers();
        archivedClustererRef.current = null;
      }
    };
  }, [messages, onFeatureClick, map]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only show full geometry at high zoom levels (>=15) to avoid visual clutter
  const shouldShowFullGeometry = currentZoom >= 15;

  return (
    <GeometryRenderer
      features={features}
      selectedFeature={selectedFeature}
      hoveredFeature={hoveredFeature}
      shouldShowFullGeometry={shouldShowFullGeometry}
      unclusteredActiveFeatures={unclusteredActiveFeatures}
      unclusteredArchivedFeatures={unclusteredArchivedFeatures}
      onFeatureClick={onFeatureClick}
      setSelectedFeature={setSelectedFeature}
      setHoveredFeature={setHoveredFeature}
    />
  );
}
