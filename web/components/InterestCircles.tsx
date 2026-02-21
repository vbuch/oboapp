"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { Interest } from "@/lib/types";
import { colors } from "@/lib/colors";

interface InterestCirclesProps {
  readonly map: google.maps.Map | null;
  readonly interests: Interest[];
  readonly onInterestClick: (interest: Interest) => void;
  readonly editingInterestId?: string | null;
  readonly hideAll?: boolean;
}

const CIRCLE_FILL_OPACITY = 0.08;
const CIRCLE_STROKE_OPACITY = 0.1;
const OPACITY_HOVER_DELTA = 0.05;
const CIRCLE_FILL_OPACITY_HOVER = Math.max(
  CIRCLE_FILL_OPACITY - OPACITY_HOVER_DELTA,
  0
);
const CIRCLE_STROKE_OPACITY_HOVER = Math.max(
  CIRCLE_STROKE_OPACITY - OPACITY_HOVER_DELTA,
  0
);

const DEFAULT_CIRCLE_COLOR = colors.interaction.circle;

export default function InterestCircles({
  map,
  interests,
  onInterestClick,
  editingInterestId,
  hideAll = false,
}: InterestCirclesProps) {
  const [hoveredInterestId, setHoveredInterestId] = useState<string | null>(
    null
  );
  const circlesMapRef = useRef<Map<string, google.maps.Circle>>(new Map());
  // Keep callbacks in refs so circle listeners always call the latest version
  const onInterestClickRef = useRef(onInterestClick);
  useEffect(() => {
    onInterestClickRef.current = onInterestClick;
  }, [onInterestClick]);

  const circlesToRender = useMemo(() => {
    if (hideAll) return [];
    return interests
      .filter((interest) => interest.id && interest.id !== editingInterestId)
      .filter(
        (interest, index, self) =>
          index === self.findIndex((i) => i.id === interest.id)
      );
  }, [interests, editingInterestId, hideAll]);

  // Build a set of IDs we want on this render for reconciliation
  const desiredIds = useMemo(
    () => new Set(circlesToRender.map((i) => i.id!)),
    [circlesToRender]
  );

  // Reconcile native circles with desired state
  useEffect(() => {
    const nativeCircles = circlesMapRef.current;

    if (!map) {
      // No map — tear down everything
      for (const circle of nativeCircles.values()) {
        circle.setMap(null);
      }
      nativeCircles.clear();
      return;
    }

    // Remove circles that are no longer desired
    for (const [id, circle] of nativeCircles.entries()) {
      if (!desiredIds.has(id)) {
        circle.setMap(null);
        nativeCircles.delete(id);
      }
    }

    // Create or update circles
    for (const interest of circlesToRender) {
      const id = interest.id!;
      const circleColor = interest.color || DEFAULT_CIRCLE_COLOR;
      const isHovered = hoveredInterestId === id;

      const existing = nativeCircles.get(id);
      if (existing) {
        // Update in place
        existing.setCenter({
          lat: interest.coordinates.lat,
          lng: interest.coordinates.lng,
        });
        existing.setRadius(interest.radius);
        existing.setOptions({
          fillColor: circleColor,
          strokeColor: circleColor,
          fillOpacity: isHovered
            ? CIRCLE_FILL_OPACITY_HOVER
            : CIRCLE_FILL_OPACITY,
          strokeOpacity: isHovered
            ? CIRCLE_STROKE_OPACITY_HOVER
            : CIRCLE_STROKE_OPACITY,
        });
      } else {
        // Create new native circle
        const nativeCircle = new google.maps.Circle({
          map,
          center: {
            lat: interest.coordinates.lat,
            lng: interest.coordinates.lng,
          },
          radius: interest.radius,
          fillColor: circleColor,
          fillOpacity: isHovered
            ? CIRCLE_FILL_OPACITY_HOVER
            : CIRCLE_FILL_OPACITY,
          strokeColor: circleColor,
          strokeOpacity: isHovered
            ? CIRCLE_STROKE_OPACITY_HOVER
            : CIRCLE_STROKE_OPACITY,
          strokeWeight: 2,
          clickable: true,
          zIndex: 1,
        });

        nativeCircle.addListener("click", () => {
          trackEvent({
            name: "zone_clicked",
            params: {
              zone_id: id,
              radius: interest.radius,
            },
          });
          const fresh = interests.find((i) => i.id === id);
          if (fresh) onInterestClickRef.current(fresh);
        });

        nativeCircle.addListener("mouseover", () => {
          setHoveredInterestId(id);
        });

        nativeCircle.addListener("mouseout", () => {
          setHoveredInterestId((prev) => (prev === id ? null : prev));
        });

        nativeCircles.set(id, nativeCircle);
      }
    }
  }, [map, circlesToRender, desiredIds, hoveredInterestId, interests]);

  // Cleanup all circles on unmount
  useEffect(() => {
    const nativeCircles = circlesMapRef.current;
    return () => {
      for (const circle of nativeCircles.values()) {
        circle.setMap(null);
      }
      nativeCircles.clear();
    };
  }, []);

  return null;
}
