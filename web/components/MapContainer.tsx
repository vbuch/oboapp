"use client";

import { useState, useEffect, useCallback } from "react";
import MapComponent from "@/components/MapComponent";
import GeolocationButton from "@/components/GeolocationButton";
import GeolocationPrompt from "@/components/GeolocationPrompt";
import OnboardingPrompt from "@/components/onboarding/OnboardingPrompt";
import { useGeolocationPrompt } from "@/lib/hooks/useGeolocationPrompt";
import { useOnboardingFlow } from "@/lib/hooks/useOnboardingFlow";
import { useAuth } from "@/lib/auth-context";
import { Message, Interest } from "@/lib/types";
import type { User } from "firebase/auth";

interface MapContainerProps {
  readonly messages: Message[];
  readonly interests: Interest[];
  readonly interestsLoaded: boolean;
  readonly user: User | null;
  readonly targetMode: {
    active: boolean;
    initialRadius?: number;
    editingInterestId?: string | null;
  };
  readonly initialMapCenter?: { lat: number; lng: number } | null;
  readonly onFeatureClick: (messageId: string) => void;
  readonly onMapReady: (
    centerMap: (
      lat: number,
      lng: number,
      zoom?: number,
      options?: { animate?: boolean },
    ) => void,
    mapInstance: google.maps.Map | null,
  ) => void;
  readonly onBoundsChanged: (bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
    zoom: number;
  }) => void;
  readonly onInterestClick: (interest: Interest) => void;
  readonly onSaveInterest: (
    coordinates: { lat: number; lng: number },
    radius: number,
  ) => void;
  readonly onCancelTargetMode: () => void;
  readonly onStartAddInterest: () => void;
}

export default function MapContainer({
  messages,
  interests,
  interestsLoaded,
  user,
  targetMode,
  initialMapCenter,
  onFeatureClick,
  onMapReady,
  onBoundsChanged,
  onInterestClick,
  onSaveInterest,
  onCancelTargetMode,
  onStartAddInterest,
}: MapContainerProps) {
  const [centerMap, setCenterMap] = useState<
    | ((
        lat: number,
        lng: number,
        zoom?: number,
        options?: { animate?: boolean },
      ) => void)
    | null
  >(null);

  // Subscription check state
  const [subscriptionsLoaded, setSubscriptionsLoaded] = useState(false);
  const [hasSubscriptions, setHasSubscriptions] = useState(false);

  const { user: authUser, loading: authLoading } = useAuth();

  // Check subscriptions when user is authenticated
  // Wait for auth and interests to finish loading first to avoid flickering
  useEffect(() => {
    // Don't do anything until auth state and interests are determined
    if (authLoading || !interestsLoaded) {
      return;
    }

    if (!authUser) {
      // Not logged in - mark as loaded with no subscriptions
      setSubscriptionsLoaded(true);
      setHasSubscriptions(false);
      return;
    }

    const checkSubscriptions = async () => {
      try {
        const token = await authUser.getIdToken();
        const response = await fetch("/api/notifications/subscription/all", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const subscriptions = await response.json();
          setHasSubscriptions(
            Array.isArray(subscriptions) && subscriptions.length > 0,
          );
        }
      } catch (error) {
        console.error("Error checking subscriptions:", error);
      } finally {
        setSubscriptionsLoaded(true);
      }
    };

    checkSubscriptions();
  }, [authUser, authLoading, interestsLoaded]);

  // Onboarding state machine
  const {
    state: onboardingState,
    handlePermissionResult,
    handleDismiss,
    handleRestart,
  } = useOnboardingFlow({
    user: authUser,
    interests,
    subscriptionsLoaded,
    hasSubscriptions,
  });

  const { showPrompt, onAccept, onDecline, requestGeolocation, isLocating } =
    useGeolocationPrompt();

  const handleMapReady = (
    centerMapFn: (
      lat: number,
      lng: number,
      zoom?: number,
      options?: { animate?: boolean },
    ) => void,
    mapInstance: google.maps.Map | null,
  ) => {
    setCenterMap(() => centerMapFn);
    onMapReady(centerMapFn, mapInstance);
  };

  const handleGeolocationClick = () => {
    if (centerMap) {
      requestGeolocation(centerMap);
    }
  };

  // Handle add interest button click in idle state
  // If logged in, go directly to creation mode (skip showing AddInterestsPrompt again)
  // If not logged in, restart the onboarding flow
  const handleAddInterestClick = useCallback(() => {
    if (onboardingState === "idle") {
      if (authUser) {
        // User already dismissed AddInterestsPrompt, go straight to creation
        onStartAddInterest();
      } else {
        // Not logged in, restart onboarding flow
        handleRestart();
      }
    } else {
      onStartAddInterest();
    }
  }, [onboardingState, authUser, handleRestart, onStartAddInterest]);

  return (
    <div className="absolute inset-0">
      <MapComponent
        messages={messages}
        onFeatureClick={onFeatureClick}
        onMapReady={handleMapReady}
        onBoundsChanged={onBoundsChanged}
        interests={interests}
        onInterestClick={onInterestClick}
        initialCenter={initialMapCenter || undefined}
        targetMode={
          targetMode.active
            ? {
                active: true,
                initialRadius: targetMode.initialRadius,
                editingInterestId: targetMode.editingInterestId,
                onSave: onSaveInterest,
                onCancel: onCancelTargetMode,
              }
            : undefined
        }
      />

      {/* Onboarding prompts - controlled by state machine */}
      <OnboardingPrompt
        state={onboardingState}
        targetModeActive={targetMode.active}
        user={user}
        onPermissionResult={handlePermissionResult}
        onDismiss={handleDismiss}
        onAddInterests={onStartAddInterest}
        onAddInterestClick={handleAddInterestClick}
      />

      {/* Geolocation button - always visible */}
      <GeolocationButton
        onClick={handleGeolocationClick}
        isLocating={isLocating}
        visible={true}
      />

      {/* Geolocation permission prompt */}
      {showPrompt && (
        <GeolocationPrompt onAccept={onAccept} onDecline={onDecline} />
      )}
    </div>
  );
}
