"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Circle } from "@react-google-maps/api";
import { trackEvent, trackEventDebounced } from "@/lib/analytics";
import { colors, borderRadius, zIndex } from "@/lib/colors";
import { buttonStyles, buttonSizes } from "@/lib/theme";

interface InterestTargetModeProps {
  readonly map: google.maps.Map | null;
  readonly initialRadius?: number;
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

  // Set initial center when map is available
  useEffect(() => {
    if (!map || currentCenter) return;

    const center = map.getCenter();
    if (center) {
      setCurrentCenter({
        lat: center.lat(),
        lng: center.lng(),
      });
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
      {/* Preview Circle */}
      {currentCenter && (
        <Circle
          center={currentCenter}
          radius={radius}
          options={{
            fillColor: colors.interaction.circle,
            fillOpacity: CIRCLE_OPACITY,
            strokeColor: colors.interaction.circle,
            strokeOpacity: CIRCLE_OPACITY * 2,
            strokeWeight: 2,
            clickable: true,
            zIndex: 10,
          }}
          onClick={(e) => {
            if (e.latLng) {
              setCurrentCenter({
                lat: e.latLng.lat(),
                lng: e.latLng.lng(),
              });
            }
          }}
        />
      )}

      {/* Control Panel */}
      <div className={`fixed sm:absolute bottom-8 left-1/2 -translate-x-1/2 ${zIndex.overlay} pointer-events-auto`}>
        <div className="bg-white rounded-lg shadow-xl border border-neutral-border p-4 min-w-[320px]">
          {/* Coordinates Display */}
          {currentCenter && (
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
