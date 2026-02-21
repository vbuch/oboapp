"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { trackEvent, trackEventDebounced } from "@/lib/analytics";
import { colors, borderRadius, zIndex } from "@/lib/colors";
import { buttonStyles, buttonSizes } from "@/lib/theme";

interface InterestTargetModeProps {
  readonly map: google.maps.Map | null;
  readonly initialRadius?: number;
  readonly pendingColor?: string;
  readonly onSave: (
    coordinates: { lat: number; lng: number },
    radius: number,
  ) => void;
  readonly onCancel: () => void;
}

const CIRCLE_OPACITY = 0.2;

// Radius constraints
const MIN_RADIUS = 100;
const MAX_RADIUS = 1000;
const DEFAULT_RADIUS = 500;

export default function InterestTargetMode({
  map,
  initialRadius = DEFAULT_RADIUS,
  pendingColor,
  onSave,
  onCancel,
}: InterestTargetModeProps) {
  const [currentCenter, setCurrentCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [radius, setRadius] = useState(initialRadius);
  const [isSaving, setIsSaving] = useState(false);
  const isEditingRef = useRef(initialRadius !== DEFAULT_RADIUS);
  const circleRef = useRef<google.maps.Circle | null>(null);

  const circleColor = pendingColor || colors.interaction.circle;

  // Manage the native Google Maps Circle imperatively to avoid
  // ghost artifacts from the @react-google-maps/api <Circle> component.
  useEffect(() => {
    if (!map || !currentCenter) {
      // Remove circle if center is cleared
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
      return;
    }

    if (!circleRef.current) {
      // Create the circle
      circleRef.current = new google.maps.Circle({
        map,
        center: currentCenter,
        radius,
        fillColor: circleColor,
        fillOpacity: CIRCLE_OPACITY,
        strokeColor: circleColor,
        strokeOpacity: CIRCLE_OPACITY * 2,
        strokeWeight: 2,
        clickable: true,
        zIndex: 10,
      });

      // Clicking the circle repositions it
      circleRef.current.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          setCurrentCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
      });
    } else {
      // Update existing circle
      circleRef.current.setCenter(currentCenter);
      circleRef.current.setRadius(radius);
      circleRef.current.setOptions({
        fillColor: circleColor,
        strokeColor: circleColor,
      });
    }

    // Cleanup: remove the circle from the map when the component unmounts
    return () => {
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
    };
  }, [map, currentCenter, radius, circleColor]);

  // When editing an existing zone, use the map center as the starting position.
  // For new zones, start with no circle — the user clicks to place it.
  useEffect(() => {
    if (!map || currentCenter) return;

    // Only auto-set the center when editing an existing interest
    if (isEditingRef.current) {
      const center = map.getCenter();
      if (center) {
        setCurrentCenter({
          lat: center.lat(),
          lng: center.lng(),
        });
      }
    }
  }, [map, currentCenter]);

  // Handle map clicks to reposition circle
  useEffect(() => {
    if (!map) return;

    const clickListener = map.addListener(
      "click",
      (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          setCurrentCenter({
            lat: e.latLng.lat(),
            lng: e.latLng.lng(),
          });
        }
      },
    );

    return () => {
      google.maps.event.removeListener(clickListener);
    };
  }, [map]);

  const handleSave = async () => {
    if (!currentCenter) return;

    setIsSaving(true);
    try {
      trackEvent({
        name: "zone_save_completed",
        params: { radius, is_new: !isEditingRef.current },
      });
      onSave(currentCenter, radius);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = useCallback(() => {
    trackEvent({
      name: "zone_save_cancelled",
      params: { is_new: !isEditingRef.current },
    });
    onCancel();
  }, [onCancel]);

  const handleRadiusChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    setRadius(value);
    // Track radius changes with debouncing to avoid performance impact
    trackEventDebounced({
      name: "zone_radius_changed",
      params: { radius: value, is_new: !isEditingRef.current },
    });
  };

  return (
    <>
      {/* Control Panel */}
      <div className={`fixed sm:absolute bottom-8 left-1/2 -translate-x-1/2 ${zIndex.overlay} pointer-events-auto`}>
        <div className="bg-white rounded-lg shadow-xl border border-neutral-border p-4 min-w-[320px]">
          {/* Placement hint or coordinates */}
          {!currentCenter ? (
            <div className="mb-4 text-sm text-neutral text-center">
              Натиснете на картата, за да поставите зоната
            </div>
          ) : (
            <div className="mb-4 text-xs text-neutral font-mono text-center">
              {currentCenter.lat.toFixed(6)}, {currentCenter.lng.toFixed(6)}
            </div>
          )}

          {/* Radius Slider */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral mb-2">
              Радиус: {radius}м
            </label>
            <input
              type="range"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              step={50}
              value={radius}
              onChange={handleRadiusChange}
              className="w-full h-2 bg-neutral-light rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-neutral mt-1">
              <span>{MIN_RADIUS}m</span>
              <span>{MAX_RADIUS}m</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className={`flex-1 ${buttonSizes.md} font-medium ${buttonStyles.ghost} ${borderRadius.sm}`}
            >
              Отказ
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!currentCenter || isSaving}
              className={`flex-1 ${buttonSizes.md} font-medium ${buttonStyles.primary} ${borderRadius.sm}`}
            >
              {isSaving ? "Запазвам..." : "Запази зоната"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
