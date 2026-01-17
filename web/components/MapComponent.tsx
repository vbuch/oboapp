"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { GoogleMap } from "@react-google-maps/api";
import { Message, Interest } from "@/lib/types";
import { SOFIA_BOUNDS } from "@/lib/bounds-utils";
import GeoJSONLayer from "./GeoJSONLayer";
import InterestCircles from "./InterestCircles";
import InterestTargetMode from "./InterestTargetMode";

interface MapComponentProps {
  readonly messages: Message[];
  readonly onFeatureClick?: (messageId: string) => void;
  readonly onMapReady?: (
    centerMap: (
      lat: number,
      lng: number,
      zoom?: number,
      options?: { animate?: boolean },
    ) => void,
    mapInstance: google.maps.Map | null,
  ) => void;
  readonly onBoundsChanged?: (bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
    zoom: number;
  }) => void;
  readonly interests?: Interest[];
  readonly onInterestClick?: (interest: Interest) => void;
  readonly targetMode?: {
    active: boolean;
    initialRadius?: number;
    editingInterestId?: string | null;
    onSave: (coordinates: { lat: number; lng: number }, radius: number) => void;
    onCancel: () => void;
  };
  readonly initialCenter?: { lat: number; lng: number };
}

// Oborishte District center coordinates
// const OBORISHTE_CENTER = {
//   lat: 42.6977,
//   lng: 23.3341,
// };
const SOFIA_CENTER = { lat: 42.6977, lng: 23.3219 };

// Bounds to restrict map panning (imported from @/lib/bounds-utils)

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

// Desaturated map style
const mapStyles = [
  {
    elementType: "geometry",
    stylers: [{ saturation: -60 }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ saturation: -40 }, { lightness: 10 }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ visibility: "on" }, { saturation: -100 }, { lightness: 60 }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ saturation: -100 }, { lightness: 40 }],
  },
  {
    featureType: "poi",
    elementType: "labels.icon",
    stylers: [{ saturation: -100 }, { lightness: 20 }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ saturation: -100 }, { lightness: 20 }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ saturation: -60 }, { lightness: 20 }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ saturation: -40 }, { lightness: 30 }],
  },
];

export default function MapComponent({
  messages,
  onFeatureClick,
  onMapReady,
  onBoundsChanged,
  interests = [],
  onInterestClick,
  targetMode,
  initialCenter,
}: MapComponentProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const latestCenterRef = useRef(SOFIA_CENTER);
  const [currentZoom, setCurrentZoom] = useState<number>(14);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const mapOptions: google.maps.MapOptions = useMemo(
    () => ({
      zoom: 14,
      center: initialCenter || SOFIA_CENTER,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: mapStyles,
      clickableIcons: false, // Disable clicking on POIs (shops, hospitals, etc.)
      restriction: {
        latLngBounds: SOFIA_BOUNDS,
        strictBounds: true,
      },
      minZoom: 12,
      maxZoom: 18,
    }),
    [initialCenter],
  );

  const centerMap = useCallback(
    (
      lat: number,
      lng: number,
      zoom: number = 17,
      options?: { animate?: boolean },
    ) => {
      if (!mapRef.current) {
        return;
      }

      const nextCenter = { lat, lng };
      latestCenterRef.current = nextCenter;
      const gmapsCenter = new google.maps.LatLng(lat, lng);

      if (options?.animate === false) {
        mapRef.current.setCenter(gmapsCenter);
      } else {
        mapRef.current.panTo(gmapsCenter);
      }

      mapRef.current.setZoom(zoom);
    },
    [],
  );

  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      setMapInstance(map);
      // Notify parent that map is ready and pass the centerMap function and map instance
      if (onMapReady) {
        onMapReady(centerMap, map);
      }
    },
    [onMapReady, centerMap],
  );

  // Get dynamic map options based on target mode
  const dynamicMapOptions = useMemo(() => {
    const baseOptions = {
      ...mapOptions,
      disableDefaultUI: true,
      gestureHandling: "greedy" as google.maps.MapOptions["gestureHandling"],
    } as const;

    // Only include center if map hasn't loaded yet (mapInstance is null)
    // This prevents re-centering when target mode changes
    const { center, ...optionsWithoutCenter } = baseOptions;
    const optionsWithConditionalCenter = mapInstance
      ? optionsWithoutCenter
      : baseOptions;

    if (targetMode?.active) {
      return {
        ...optionsWithConditionalCenter,
        scrollwheel: true,
        disableDoubleClickZoom: false,
      };
    }

    return optionsWithConditionalCenter;
  }, [targetMode?.active, mapOptions, mapInstance]);

  const handleCenterChanged = useCallback(() => {
    if (!mapRef.current) return;
    const center = mapRef.current.getCenter();
    if (!center) return;
    latestCenterRef.current = {
      lat: center.lat(),
      lng: center.lng(),
    };
  }, []);

  const handleBoundsChangedInternal = useCallback(() => {
    if (!mapRef.current || !onBoundsChanged) return;

    const bounds = mapRef.current.getBounds();
    const zoom = mapRef.current.getZoom();
    if (!bounds || zoom === undefined) return;

    setCurrentZoom(zoom);

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    onBoundsChanged({
      north: ne.lat(),
      south: sw.lat(),
      east: ne.lng(),
      west: sw.lng(),
      zoom,
    });
  }, [onBoundsChanged]);

  return (
    <div className="absolute inset-0">
      {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          options={dynamicMapOptions}
          onLoad={onMapLoad}
          onCenterChanged={handleCenterChanged}
          onBoundsChanged={handleBoundsChangedInternal}
        >
          <GeoJSONLayer
            messages={messages}
            onFeatureClick={onFeatureClick}
            map={mapInstance}
            currentZoom={currentZoom}
          />

          {/* Render interest circles */}
          {interests && interests.length > 0 && onInterestClick && (
            <InterestCircles
              interests={interests}
              onInterestClick={onInterestClick}
              editingInterestId={targetMode?.editingInterestId}
              hideAll={false}
            />
          )}

          {/* Render target mode overlay when active */}
          {targetMode?.active && (
            <InterestTargetMode
              map={mapInstance}
              initialRadius={targetMode.initialRadius}
              onSave={targetMode.onSave}
              onCancel={targetMode.onCancel}
            />
          )}
        </GoogleMap>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <p className="text-red-600">Няма настроен ключ за Google Maps API</p>
        </div>
      )}
    </div>
  );
}
