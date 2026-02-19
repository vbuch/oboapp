import { useState, useCallback } from "react";
import { trackEvent } from "@/lib/analytics";
import { Interest } from "@/lib/types";

type CenterMapFn = (
  lat: number,
  lng: number,
  zoom?: number,
  options?: { animate?: boolean },
) => void;

interface TargetMode {
  active: boolean;
  initialRadius?: number;
  editingInterestId?: string | null;
  pendingLabel?: string;
  pendingColor?: string;
}

/**
 * Custom hook for managing interest/zone operations
 *
 * Handles:
 * - Interest selection and context menu
 * - Target mode for adding/editing interests
 * - Move, delete, save, cancel operations
 */
export function useInterestManagement(
  centerMapFn: CenterMapFn | null,
  mapInstance: google.maps.Map | null,
  addInterest: (
    coordinates: { lat: number; lng: number },
    radius: number,
    metadata?: { label?: string; color?: string },
  ) => Promise<void>,
  updateInterest: (
    id: string,
    updates: { coordinates?: { lat: number; lng: number }; radius?: number },
  ) => Promise<void>,
  deleteInterest: (id: string) => Promise<void>,
) {
  const [targetMode, setTargetMode] = useState<TargetMode>({ active: false });
  const [selectedInterest, setSelectedInterest] = useState<Interest | null>(
    null,
  );
  const [interestMenuPosition, setInterestMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleInterestClick = useCallback(
    (interest: Interest) => {
      setSelectedInterest(interest);

      if (mapInstance) {
        // Use OverlayView to convert lat/lng to screen coordinates
        const overlay = new google.maps.OverlayView();
        overlay.setMap(mapInstance);
        overlay.onAdd = function () {};
        overlay.onRemove = function () {};
        overlay.draw = function () {
          const projection = this.getProjection();
          if (projection) {
            const latLng = new google.maps.LatLng(
              interest.coordinates.lat,
              interest.coordinates.lng,
            );
            const point = projection.fromLatLngToContainerPixel(latLng);

            if (point) {
              // Get map container position
              const mapDiv = mapInstance.getDiv();
              const bounds = mapDiv.getBoundingClientRect();

              setInterestMenuPosition({
                x: bounds.left + point.x,
                y: bounds.top + point.y,
              });
            }
          }
          // Clean up
          overlay.setMap(null);
        };
        return;
      }

      // Fallback to center if map is not available
      setInterestMenuPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
    },
    [mapInstance],
  );

  const handleMoveInterest = useCallback(() => {
    if (!selectedInterest || !centerMapFn) return;

    trackEvent({
      name: "zone_move_initiated",
      params: {
        zone_id: selectedInterest.id || "unknown",
        current_radius: selectedInterest.radius,
      },
    });

    // Center map on the interest so it stays in the same visual position
    centerMapFn(
      selectedInterest.coordinates.lat,
      selectedInterest.coordinates.lng,
      17,
      { animate: false },
    );

    // Enter target mode with the interest being edited
    setTargetMode({
      active: true,
      initialRadius: selectedInterest.radius,
      editingInterestId: selectedInterest.id,
      pendingColor: selectedInterest.color,
      pendingLabel: selectedInterest.label,
    });

    // Close menu
    setInterestMenuPosition(null);
    setSelectedInterest(null);
  }, [selectedInterest, centerMapFn]);

  const handleDeleteInterest = useCallback(async () => {
    if (!selectedInterest?.id) return;

    try {
      trackEvent({
        name: "zone_deleted",
        params: {
          zone_id: selectedInterest.id,
          radius: selectedInterest.radius,
        },
      });
      await deleteInterest(selectedInterest.id);
      setInterestMenuPosition(null);
      setSelectedInterest(null);
    } catch (error) {
      console.error("Failed to delete interest:", error);

      // Check if it's a 404 (already deleted, likely a duplicate)
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("404")) {
        console.warn(
          "Interest already deleted (likely a duplicate), removing from local state",
        );
        setInterestMenuPosition(null);
        setSelectedInterest(null);
        // Refresh to sync state
        globalThis.location.reload();
      } else {
        alert("Не успях да изтрия зоната. Опитай пак.");
      }
    }
  }, [selectedInterest, deleteInterest]);

  const handleStartAddInterest = useCallback(
    (config?: { label?: string; color?: string; radius?: number }) => {
      setTargetMode({
        active: true,
        initialRadius: config?.radius ?? 500,
        editingInterestId: null,
        pendingLabel: config?.label,
        pendingColor: config?.color,
      });
    },
    [],
  );

  const handleSaveInterest = useCallback(
    (coordinates: { lat: number; lng: number }, radius: number) => {
      (async () => {
        try {
          if (targetMode.editingInterestId) {
            // Update existing interest
            await updateInterest(targetMode.editingInterestId, {
              coordinates,
              radius,
            });
          } else {
            // Add new interest (with optional label/color from pending zone)
            await addInterest(coordinates, radius, {
              label: targetMode.pendingLabel,
              color: targetMode.pendingColor,
            });
          }

          // Exit target mode
          setTargetMode({ active: false });
        } catch (error) {
          console.error("Failed to save interest:", error);
          alert("Не успях да запазя зоната. Опитай пак.");
        }
      })();
    },
    [targetMode.editingInterestId, targetMode.pendingLabel, targetMode.pendingColor, addInterest, updateInterest],
  );

  const handleCancelTargetMode = useCallback(() => {
    setTargetMode({ active: false });
  }, []);

  const handleCloseInterestMenu = useCallback(() => {
    setInterestMenuPosition(null);
    setSelectedInterest(null);
  }, []);

  return {
    targetMode,
    selectedInterest,
    interestMenuPosition,
    handleInterestClick,
    handleMoveInterest,
    handleDeleteInterest,
    handleStartAddInterest,
    handleSaveInterest,
    handleCancelTargetMode,
    handleCloseInterestMenu,
  };
}
