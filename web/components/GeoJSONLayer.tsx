"use client";

import React from "react";
import { Marker, Polyline, Polygon } from "@react-google-maps/api";
import { trackEvent } from "@/lib/analytics";
import { Message } from "@/lib/types";
import { colors, opacity } from "@/lib/colors";

interface GeoJSONLayerProps {
  readonly messages: Message[];
  readonly onFeatureClick?: (messageId: string) => void;
}

const GEOJSON_STYLES = {
  lineString: {
    strokeColor: colors.primary.red,
    strokeOpacity: opacity.default,
    strokeWeight: 3,
    zIndex: 5,
  },
  lineStringHover: {
    strokeColor: colors.primary.red,
    strokeOpacity: opacity.hover,
    strokeWeight: 4,
    zIndex: 6,
  },
  polygon: {
    strokeColor: colors.primary.red,
    strokeOpacity: opacity.default,
    strokeWeight: 2,
    fillColor: colors.primary.red,
    fillOpacity: opacity.fill,
    zIndex: 5,
  },
  polygonHover: {
    strokeColor: colors.primary.red,
    strokeOpacity: opacity.hover,
    strokeWeight: 3,
    fillColor: colors.primary.red,
    fillOpacity: opacity.fillHover,
    zIndex: 6,
  },
};

// Helper: Transform GeoJSON coordinate to Google Maps LatLng
const toLatLng = (coord: number[]) => ({
  lat: coord[1],
  lng: coord[0],
});

// Helper: Create feature click handler
const createClickHandler = (
  messageId: string | undefined,
  geometryType: "Point" | "LineString" | "Polygon",
  onFeatureClick?: (messageId: string) => void
) => {
  return () => {
    if (messageId && onFeatureClick) {
      trackEvent({
        name: "map_feature_clicked",
        params: {
          message_id: messageId || "unknown",
          geometry_type: geometryType,
        },
      });
      onFeatureClick(messageId);
    }
  };
};

// Helper: Create hover handlers
const createHoverHandlers = (
  featureKey: string,
  setHoveredFeature: (key: string | null) => void
) => ({
  onMouseOver: () => setHoveredFeature(featureKey),
  onMouseOut: () => setHoveredFeature(null),
});

// Point feature component
interface PointFeatureProps {
  coords: number[];
  isHovered: boolean;
  messageId: string | undefined;
  featureProperties: any;
  featureKey: string;
  onFeatureClick?: (messageId: string) => void;
  setHoveredFeature: (key: string | null) => void;
}

function PointFeature({
  coords,
  isHovered,
  messageId,
  featureProperties,
  featureKey,
  onFeatureClick,
  setHoveredFeature,
}: PointFeatureProps) {
  return (
    <Marker
      position={toLatLng(coords)}
      icon={{
        path: "M 0,0 m -8,0 a 8,8 0 1,0 16,0 a 8,8 0 1,0 -16,0",
        fillColor: colors.primary.red,
        fillOpacity: isHovered ? opacity.hover : opacity.default,
        strokeWeight: 2,
        strokeColor: colors.map.stroke,
        scale: isHovered ? 1.2 : 1,
      }}
      title={featureProperties?.address || "Маркер"}
      zIndex={10}
      onClick={createClickHandler(messageId, "Point", onFeatureClick)}
      {...createHoverHandlers(featureKey, setHoveredFeature)}
      options={{ cursor: "pointer" }}
    />
  );
}

// LineString feature component
interface LineStringFeatureProps {
  coords: number[][];
  isHovered: boolean;
  messageId: string | undefined;
  featureKey: string;
  onFeatureClick?: (messageId: string) => void;
  setHoveredFeature: (key: string | null) => void;
}

function LineStringFeature({
  coords,
  isHovered,
  messageId,
  featureKey,
  onFeatureClick,
  setHoveredFeature,
}: LineStringFeatureProps) {
  return (
    <Polyline
      path={coords.map(toLatLng)}
      options={{
        ...(isHovered
          ? GEOJSON_STYLES.lineStringHover
          : GEOJSON_STYLES.lineString),
        clickable: true,
      }}
      onClick={createClickHandler(messageId, "LineString", onFeatureClick)}
      {...createHoverHandlers(featureKey, setHoveredFeature)}
    />
  );
}

// Polygon feature component
interface PolygonFeatureProps {
  coords: number[][][];
  isHovered: boolean;
  messageId: string | undefined;
  featureKey: string;
  onFeatureClick?: (messageId: string) => void;
  setHoveredFeature: (key: string | null) => void;
}

function PolygonFeature({
  coords,
  isHovered,
  messageId,
  featureKey,
  onFeatureClick,
  setHoveredFeature,
}: PolygonFeatureProps) {
  return (
    <Polygon
      paths={coords[0].map(toLatLng)}
      options={{
        ...(isHovered ? GEOJSON_STYLES.polygonHover : GEOJSON_STYLES.polygon),
        clickable: true,
      }}
      onClick={createClickHandler(messageId, "Polygon", onFeatureClick)}
      {...createHoverHandlers(featureKey, setHoveredFeature)}
    />
  );
}

export default function GeoJSONLayer({
  messages,
  onFeatureClick,
}: GeoJSONLayerProps) {
  const [hoveredFeature, setHoveredFeature] = React.useState<string | null>(
    null
  );

  const features: React.ReactElement[] = [];

  messages.forEach((message) => {
    if (!message.geoJson?.features) {
      return;
    }

    message.geoJson.features.forEach((feature, featureIndex) => {
      const key = `${message.id}-geojson-${featureIndex}`;
      const isHovered = hoveredFeature === key;
      const { geometry, properties } = feature;

      switch (geometry.type) {
        case "Point":
          features.push(
            <PointFeature
              key={key}
              coords={geometry.coordinates}
              isHovered={isHovered}
              messageId={message.id}
              featureProperties={properties}
              featureKey={key}
              onFeatureClick={onFeatureClick}
              setHoveredFeature={setHoveredFeature}
            />
          );
          break;
        case "LineString":
          features.push(
            <LineStringFeature
              key={key}
              coords={geometry.coordinates}
              isHovered={isHovered}
              messageId={message.id}
              featureKey={key}
              onFeatureClick={onFeatureClick}
              setHoveredFeature={setHoveredFeature}
            />
          );
          break;
        case "Polygon":
          features.push(
            <PolygonFeature
              key={key}
              coords={geometry.coordinates}
              isHovered={isHovered}
              messageId={message.id}
              featureKey={key}
              onFeatureClick={onFeatureClick}
              setHoveredFeature={setHoveredFeature}
            />
          );
          break;
      }
    });
  });

  return <>{features}</>;
}
