"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { colors } from "@/lib/colors";

type HeatmapPoint = [number, number];

interface HeatmapResponse {
  points: HeatmapPoint[];
}

const SOFIA_CENTER: [number, number] = [42.6977, 23.3219];
const DEFAULT_ZOOM = 13;

// Heatmap gradient using theme colors: cool → warm → hot
const HEATMAP_GRADIENT = {
  0.4: colors.zones.blue,
  0.65: colors.semantic.warning,
  1: colors.semantic.error,
};

async function fetchHeatmapPoints(): Promise<HeatmapPoint[]> {
  const response = await fetch("/api/messages/heatmap");
  if (!response.ok) {
    throw new Error("Failed to fetch heatmap data");
  }
  const data = (await response.json()) as HeatmapResponse;
  return data.points;
}

export default function HistoryMapClient() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pointCount, setPointCount] = useState(0);

  useEffect(() => {
    if (!mapRef.current) return;

    // Avoid double-initialization (React Strict Mode double-invoke)
    if (mapInstanceRef.current) return;

    let cancelled = false;

    async function init() {
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet.heat");

        if (cancelled || !mapRef.current || mapInstanceRef.current) return;

        const map = L.map(mapRef.current, {
          center: SOFIA_CENTER,
          zoom: DEFAULT_ZOOM,
          zoomControl: true,
          maxZoom: 15,
        });
        mapInstanceRef.current = map;

        // CartoDB Positron: a clean, desaturated base map (no API key required)
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 15,
            subdomains: "abcd",
          },
        ).addTo(map);

        const points = await fetchHeatmapPoints();
        if (cancelled) return;
        setPointCount(points.length);

        if (points.length > 0) {
          (L as unknown as { heatLayer: (points: HeatmapPoint[], options: Record<string, unknown>) => import("leaflet").Layer })
            .heatLayer(points, {
              radius: 20,
              blur: 25,
              maxZoom: 17,
              gradient: HEATMAP_GRADIENT,
            })
            .addTo(map);
        }

        if (!cancelled) setIsLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error("Error initializing heatmap:", err);
          setError("Грешка при зареждане на картата");
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[500px]">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-light">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-neutral">Зареждане на данните...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-light">
          <div className="rounded-md border border-error-border bg-error-light p-4 text-error text-sm">
            {error}
          </div>
        </div>
      )}

      <div ref={mapRef} className="w-full h-full min-h-[500px]" />

      {!isLoading && !error && pointCount > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400] pointer-events-none">
          <div className="bg-white/90 rounded-lg px-3 py-1.5 shadow text-xs text-neutral border border-neutral-border">
            {pointCount.toLocaleString("bg-BG")} точки от исторически данни
          </div>
        </div>
      )}
    </div>
  );
}
