"use client";

import React from "react";
import { Polyline, Polygon } from "@react-google-maps/api";
import { trackEvent } from "@/lib/analytics";
import { toLatLng, createFeatureKey } from "@/lib/geometry-utils";
import { FeatureData } from "@/lib/feature-utils";
import { getGeometryStyle } from "@/lib/marker-config";

/**
 * Props for the GeometryRenderer component
 */
export interface GeometryRendererProps {
  readonly features: FeatureData[];
  readonly selectedFeature: string | null;
  readonly hoveredFeature: string | null;
  readonly hoveredMessageId?: string | null;
  readonly selectedMessageId?: string | null;
  readonly shouldShowFullGeometry: boolean;
  readonly unclusteredActiveFeatures: Set<string>;
  readonly unclusteredArchivedFeatures: Set<string>;
  readonly onFeatureClick?: (messageId: string) => void;
  readonly setSelectedFeature: (feature: string | null) => void;
  readonly setHoveredFeature: (feature: string | null) => void;
}

/**
 * Renders geometry features (LineString and Polygon) as Polyline and Polygon components
 *
 * Handles rendering of unclustered features and selected features with proper styling
 * based on hover, selection state, and classification (active vs archived).
 * Renders archived geometry first (lower z-index), then active geometry (higher z-index).
 */
export default function GeometryRenderer({
  features,
  selectedFeature,
  hoveredFeature,
  hoveredMessageId,
  selectedMessageId,
  shouldShowFullGeometry,
  unclusteredActiveFeatures,
  unclusteredArchivedFeatures,
  onFeatureClick,
  setSelectedFeature,
  setHoveredFeature,
}: GeometryRendererProps) {
  // Early return if geometry shouldn't be shown
  if (!shouldShowFullGeometry) {
    return null;
  }

  // Combine unclustered sets for easier checking
  const allUnclusteredFeatures = new Set([
    ...unclusteredActiveFeatures,
    ...unclusteredArchivedFeatures,
  ]);

  // Get unclustered feature data for rendering full geometry
  const unclusteredFeatureData = features.filter((feature) => {
    const key = createFeatureKey(feature.messageId, feature.featureIndex);
    return allUnclusteredFeatures.has(key);
  });

  // Get selected feature data
  const selectedFeatureData = selectedFeature
    ? features.find(
        (f) => createFeatureKey(f.messageId, f.featureIndex) === selectedFeature
      )
    : null;

  /**
   * Creates click handler for geometry features
   */
  const createGeometryClickHandler = (feature: FeatureData) => () => {
    const key = createFeatureKey(feature.messageId, feature.featureIndex);
    setSelectedFeature(key);
    if (onFeatureClick) {
      trackEvent({
        name: "map_feature_clicked",
        params: {
          message_id: feature.messageId,
          geometry_type: feature.geometry.type,
          classification: feature.classification,
        },
      });
      onFeatureClick(feature.messageId);
    }
  };

  /**
   * Creates mouse over handler for geometry features
   */
  const createMouseOverHandler = (feature: FeatureData) => () => {
    const key = createFeatureKey(feature.messageId, feature.featureIndex);
    setHoveredFeature(key);
  };

  /**
   * Mouse out handler for geometry features
   */
  const handleMouseOut = () => {
    setHoveredFeature(null);
  };

  return (
    <>
      {/* Render archived geometry FIRST (lower z-index) */}
      {unclusteredFeatureData
        .filter((f) => f.classification === "archived")
        .map((feature) => {
          const key = createFeatureKey(feature.messageId, feature.featureIndex);
          const isHovered = hoveredFeature === key || hoveredMessageId === feature.messageId || selectedMessageId === feature.messageId;
          const isSelected = selectedFeature === key;

          if (feature.geometry.type === "LineString") {
            return (
              <Polyline
                key={key}
                path={feature.geometry.coordinates.map(toLatLng)}
                options={{
                  ...getGeometryStyle(
                    "LineString",
                    isHovered,
                    isSelected,
                    "archived"
                  ),
                  clickable: true,
                }}
                onClick={createGeometryClickHandler(feature)}
                onMouseOver={createMouseOverHandler(feature)}
                onMouseOut={handleMouseOut}
              />
            );
          }

          if (feature.geometry.type === "Polygon") {
            return (
              <Polygon
                key={key}
                paths={feature.geometry.coordinates[0].map(toLatLng)}
                options={{
                  ...getGeometryStyle(
                    "Polygon",
                    isHovered,
                    isSelected,
                    "archived"
                  ),
                  clickable: true,
                }}
                onClick={createGeometryClickHandler(feature)}
                onMouseOver={createMouseOverHandler(feature)}
                onMouseOut={handleMouseOut}
              />
            );
          }

          return null;
        })}

      {/* Render active geometry SECOND (higher z-index) */}
      {unclusteredFeatureData
        .filter((f) => f.classification === "active")
        .map((feature) => {
          const key = createFeatureKey(feature.messageId, feature.featureIndex);
          const isHovered = hoveredFeature === key || hoveredMessageId === feature.messageId || selectedMessageId === feature.messageId;
          const isSelected = selectedFeature === key;

          if (feature.geometry.type === "LineString") {
            return (
              <Polyline
                key={key}
                path={feature.geometry.coordinates.map(toLatLng)}
                options={{
                  ...getGeometryStyle(
                    "LineString",
                    isHovered,
                    isSelected,
                    "active"
                  ),
                  clickable: true,
                }}
                onClick={createGeometryClickHandler(feature)}
                onMouseOver={createMouseOverHandler(feature)}
                onMouseOut={handleMouseOut}
              />
            );
          }

          if (feature.geometry.type === "Polygon") {
            return (
              <Polygon
                key={key}
                paths={feature.geometry.coordinates[0].map(toLatLng)}
                options={{
                  ...getGeometryStyle(
                    "Polygon",
                    isHovered,
                    isSelected,
                    "active"
                  ),
                  clickable: true,
                }}
                onClick={createGeometryClickHandler(feature)}
                onMouseOver={createMouseOverHandler(feature)}
                onMouseOut={handleMouseOut}
              />
            );
          }

          return null;
        })}

      {/* Render selected feature if it's clustered (not in unclustered sets) */}
      {selectedFeatureData && !allUnclusteredFeatures.has(selectedFeature!) && (
        <>
          {selectedFeatureData.geometry.type === "LineString" && (
            <Polyline
              key={`selected-${selectedFeature}`}
              path={selectedFeatureData.geometry.coordinates.map(toLatLng)}
              options={{
                ...getGeometryStyle(
                  "LineString",
                  false,
                  true,
                  selectedFeatureData.classification
                ),
                clickable: true,
              }}
              onClick={createGeometryClickHandler(selectedFeatureData)}
              onMouseOver={createMouseOverHandler(selectedFeatureData)}
              onMouseOut={handleMouseOut}
            />
          )}
          {selectedFeatureData.geometry.type === "Polygon" && (
            <Polygon
              key={`selected-${selectedFeature}`}
              paths={selectedFeatureData.geometry.coordinates[0].map(toLatLng)}
              options={{
                ...getGeometryStyle(
                  "Polygon",
                  false,
                  true,
                  selectedFeatureData.classification
                ),
                clickable: true,
              }}
              onClick={createGeometryClickHandler(selectedFeatureData)}
              onMouseOver={createMouseOverHandler(selectedFeatureData)}
              onMouseOut={handleMouseOut}
            />
          )}
        </>
      )}
    </>
  );
}
