"use client";

import { useState, useCallback } from "react";
import { trackEvent } from "@/lib/analytics";

interface GeolocationPromptState {
  show: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

const GEOLOCATION_PERMISSION_KEY = "geolocationPermissionGranted";

export function useGeolocationPrompt() {
  const [promptState, setPromptState] = useState<GeolocationPromptState | null>(
    null,
  );
  const [isLocating, setIsLocating] = useState(false);

  const getStoredPermissionState = useCallback(() => {
    try {
      const stored = localStorage.getItem(GEOLOCATION_PERMISSION_KEY);
      return stored === "true";
    } catch {
      return false;
    }
  }, []);

  const setStoredPermissionState = useCallback((granted: boolean) => {
    try {
      localStorage.setItem(GEOLOCATION_PERMISSION_KEY, granted.toString());
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const getCurrentPosition = useCallback(() => {
    return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error("Geolocation is not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          let errorMessage =
            "Неизвестна грешка при определяне на местоположението";

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Достъпът до местоположението е отказан";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Местоположението не може да бъде определено";
              break;
            case error.TIMEOUT:
              errorMessage = "Изтече времето за определяне на местоположението";
              break;
          }

          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: false, // Accept coarse location
          timeout: 15000, // 15 seconds timeout
          maximumAge: 300000, // 5 minutes cache
        },
      );
    });
  }, []);

  const requestGeolocation = useCallback(
    async (
      centerMap: (
        lat: number,
        lng: number,
        zoom?: number,
        options?: { animate?: boolean },
      ) => void,
    ): Promise<void> => {
      const hasPermission = getStoredPermissionState();

      if (hasPermission) {
        // Permission already granted, directly get location
        setIsLocating(true);
        try {
          const position = await getCurrentPosition();
          centerMap(position.lat, position.lng, 17, { animate: true });

          trackEvent({
            name: "geolocation_location_centered",
            params: { had_cached_permission: true },
          });
          // Successfully obtained location
          return; // Return early after successful location
        } catch (error) {
          console.error("Geolocation error:", error);
          alert(
            error instanceof Error
              ? error.message
              : "Грешка при определяне на местоположението",
          );

          trackEvent({
            name: "geolocation_error",
            params: {
              error_type: "location_failed",
              had_cached_permission: true,
            },
          });
          throw error;
        } finally {
          setIsLocating(false);
        }
      }

      // Show permission prompt first - return a promise that resolves when accepted
      return new Promise<void>((resolve, reject) => {
        const handleAccept = async () => {
          setPromptState(null);
          setIsLocating(true);

          try {
            const position = await getCurrentPosition();
            setStoredPermissionState(true);
            centerMap(position.lat, position.lng, 17, { animate: true });

            trackEvent({
              name: "geolocation_permission_granted",
              params: {},
            });

            trackEvent({
              name: "geolocation_location_centered",
              params: { had_cached_permission: false },
            });
            resolve();
          } catch (error) {
            console.error("Geolocation error:", error);
            alert(
              error instanceof Error
                ? error.message
                : "Грешка при определяне на местоположението",
            );

            trackEvent({
              name: "geolocation_permission_denied",
              params: {},
            });
            reject(error);
          } finally {
            setIsLocating(false);
          }
        };

        setPromptState({
          show: true,
          onAccept: () => {
            void handleAccept();
          },
          onDecline: () => {
            setPromptState(null);

            trackEvent({
              name: "geolocation_prompt_declined",
              params: {},
            });
            reject(new Error("User declined geolocation permission"));
          },
        });

        trackEvent({
          name: "geolocation_prompt_shown",
          params: {},
        });
      });
    },
    [getCurrentPosition, getStoredPermissionState, setStoredPermissionState],
  );

  const hidePrompt = useCallback(() => {
    setPromptState(null);
  }, []);

  return {
    showPrompt: promptState?.show || false,
    onAccept: promptState?.onAccept || (() => {}),
    onDecline: promptState?.onDecline || (() => {}),
    requestGeolocation,
    hidePrompt,
    isLocating,
  };
}
