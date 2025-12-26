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

export default function GeoJSONLayer({
  messages,
  onFeatureClick,
}: GeoJSONLayerProps) {
  const features: React.ReactElement[] = [];
  const [hoveredFeature, setHoveredFeature] = React.useState<string | null>(
    null
  );

  messages.forEach((message) => {
    if (!message.geoJson?.features) {
      return;
    }

    message.geoJson.features.forEach((feature, featureIndex) => {
      const key = `${message.id}-geojson-${featureIndex}`;

      // Render based on geometry type
      if (feature.geometry.type === "Point") {
        const coords = feature.geometry.coordinates;

        features.push(
          <Marker
            key={key}
            position={{ lat: coords[1], lng: coords[0] }}
            icon={{
              path: "M 0,0 m -8,0 a 8,8 0 1,0 16,0 a 8,8 0 1,0 -16,0", // SVG circle path
              fillColor: colors.primary.red,
              fillOpacity:
                hoveredFeature === key ? opacity.hover : opacity.default,
              strokeWeight: 2,
              strokeColor: colors.map.stroke,
              scale: hoveredFeature === key ? 1.2 : 1,
            }}
            title={feature.properties?.address || "Маркер"}
            zIndex={10}
            onClick={() => {
              if (message.id && onFeatureClick) {
                trackEvent({
                  name: "map_feature_clicked",
                  params: {
                    message_id: message.id,
                    geometry_type: "Point",
                  },
                });
                onFeatureClick(message.id);
              }
            }}
            onMouseOver={() => setHoveredFeature(key)}
            onMouseOut={() => setHoveredFeature(null)}
            options={{
              cursor: "pointer",
            }}
          />
        );
      } else if (feature.geometry.type === "LineString") {
        const path = feature.geometry.coordinates.map((coord) => ({
          lat: coord[1],
          lng: coord[0],
        }));
        const isHovered = hoveredFeature === key;
        features.push(
          <Polyline
            key={key}
            path={path}
            options={{
              ...(isHovered
                ? GEOJSON_STYLES.lineStringHover
                : GEOJSON_STYLES.lineString),
              clickable: true,
            }}
            onClick={() => {
              if (message.id && onFeatureClick) {
                trackEvent({
                  name: "map_feature_clicked",
                  params: {
                    message_id: message.id,
                    geometry_type: "LineString",
                  },
                });
                onFeatureClick(message.id);
              }
            }}
            onMouseOver={() => setHoveredFeature(key)}
            onMouseOut={() => setHoveredFeature(null)}
          />
        );
      } else if (feature.geometry.type === "Polygon") {
        const paths = feature.geometry.coordinates[0].map((coord) => ({
          lat: coord[1],
          lng: coord[0],
        }));
        const isHovered = hoveredFeature === key;
        features.push(
          <Polygon
            key={key}
            paths={paths}
            options={{
              ...(isHovered
                ? GEOJSON_STYLES.polygonHover
                : GEOJSON_STYLES.polygon),
              clickable: true,
            }}
            onClick={() => {
              if (message.id && onFeatureClick) {
                trackEvent({
                  name: "map_feature_clicked",
                  params: {
                    message_id: message.id,
                    geometry_type: "Polygon",
                  },
                });
                onFeatureClick(message.id);
              }
            }}
            onMouseOver={() => setHoveredFeature(key)}
            onMouseOut={() => setHoveredFeature(null)}
          />
        );
      }
    });
  });

  return <>{features}</>;
}
