import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { parseMapCenterFromParams } from "./useMapNavigation.utils";

type CenterMapFn = (
  lat: number,
  lng: number,
  zoom?: number,
  options?: { animate?: boolean },
) => void;

const MOBILE_MAX_WIDTH_PX = 639;
const MOBILE_PAN_DELAY_MS = 50;
const MOBILE_PAN_OFFSET_RATIO = 0.2;

/**
 * Custom hook for managing map navigation and centering
 *
 * Handles:
 * - URL-based map centering (from settings page zone clicks)
 * - Map ready callback to receive centerMap function
 * - Address click centering
 * - Initial map center state
 */
export function useMapNavigation() {
  const [initialMapCenter, setInitialMapCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [centerMapFn, setCenterMapFn] = useState<CenterMapFn | null>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const hasProcessedUrlRef = useRef(false);
  const mobilePanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const searchParams = useSearchParams();

  useEffect(() => {
    return () => {
      if (mobilePanTimeoutRef.current) {
        clearTimeout(mobilePanTimeoutRef.current);
      }
    };
  }, []);

  // Handle URL-based map centering (from settings page zone clicks)
  useEffect(() => {
    if (hasProcessedUrlRef.current) return;

    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");

    const center = parseMapCenterFromParams(lat, lng);
    if (center) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInitialMapCenter(center);
      hasProcessedUrlRef.current = true;
      // Clear query params after setting initial center
      globalThis.history.replaceState({}, "", "/");
    }
  }, [searchParams]);

  // Center map when initialMapCenter is set (from URL params)
  useEffect(() => {
    if (initialMapCenter && centerMapFn) {
      centerMapFn(initialMapCenter.lat, initialMapCenter.lng, 16);
    }
  }, [initialMapCenter, centerMapFn]);

  // Handle map ready - receive centerMap function and map instance
  const handleMapReady = useCallback(
    (centerMap: CenterMapFn, map: google.maps.Map | null) => {
      setCenterMapFn(() => centerMap);
      setMapInstance(map);
    },
    [],
  );

  // Handle address click - center map on coordinates
  const handleAddressClick = useCallback(
    (lat: number, lng: number) => {
      if (centerMapFn) {
        centerMapFn(lat, lng, 18);
        // On mobile, offset the center upward so the pin appears above the details panel
        if (mapInstance && window.innerWidth <= MOBILE_MAX_WIDTH_PX) {
          if (mobilePanTimeoutRef.current) {
            clearTimeout(mobilePanTimeoutRef.current);
          }
          mobilePanTimeoutRef.current = setTimeout(() => {
            mapInstance.panBy(0, window.innerHeight * MOBILE_PAN_OFFSET_RATIO);
            mobilePanTimeoutRef.current = null;
          }, MOBILE_PAN_DELAY_MS);
        }
      }
    },
    [centerMapFn, mapInstance],
  );

  return {
    initialMapCenter,
    centerMapFn,
    mapInstance,
    handleMapReady,
    handleAddressClick,
  };
}
