"use client";

import { useEffect, useRef } from "react";
import { colors } from "@/lib/colors";
import { getLocalityCenter } from "@/lib/bounds-utils";
import type { HeatmapMode } from "../api/notifications/report/aggregation";

type HeatmapPoint = [number, number];

declare module "leaflet" {
  export function heatLayer(
    points: HeatmapPoint[],
    options: Record<string, unknown>,
  ): import("leaflet").Layer;
}

interface NotificationsReportMapClientProps {
  readonly mode: HeatmapMode;
  readonly points: HeatmapPoint[];
  readonly loading: boolean;
}

const DEFAULT_ZOOM = 13;
const MAP_CENTER = getLocalityCenter();

const HEATMAP_GRADIENT = {
  0.4: colors.zones.blue,
  0.65: colors.semantic.warning,
  1: colors.semantic.error,
};

export default function NotificationsReportMapClient({
  points,
  loading,
}: NotificationsReportMapClientProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const heatLayerRef = useRef<import("leaflet").Layer | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const isMapReadyRef = useRef(false);

  // Initialise map once on mount
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    let cancelled = false;

    async function initMap() {
      try {
        const leafletModule = await import("leaflet");
        const L: typeof import("leaflet") =
          "default" in leafletModule ? leafletModule.default : leafletModule;
        await import("leaflet.heat");

        if (cancelled || !mapRef.current) return;

        const map = L.map(mapRef.current, {
          center: MAP_CENTER,
          zoom: DEFAULT_ZOOM,
          zoomControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;
        leafletRef.current = L;
        isMapReadyRef.current = true;
      } catch {
        // Map init failed — no-op
      }
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        isMapReadyRef.current = false;
      }
    };
  }, []);

  // Update heatmap layer when points change
  useEffect(() => {
    if (!isMapReadyRef.current || !leafletRef.current || !mapInstanceRef.current) return;

    const L = leafletRef.current;
    const map = mapInstanceRef.current;

    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (points.length > 0) {
      const layer = L.heatLayer(points, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        gradient: HEATMAP_GRADIENT,
      });
      layer.addTo(map);
      heatLayerRef.current = layer;
    }
  }, [points]);

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-light/75">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <div ref={mapRef} className="w-full h-full" />
      {!loading && points.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-neutral bg-neutral-surface/90 px-3 py-2 rounded">
            Няма данни за показване
          </p>
        </div>
      )}
    </div>
  );
}
