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
  pendingColor?: string;
}

interface PendingInterestSelection {
  readonly coordinates: { lat: number; lng: number };
  readonly radius: number;
}

function hasValidCoordinates(
  coordinates: Interest["coordinates"] | undefined,
): coordinates is Interest["coordinates"] {
  return (
    !!coordinates &&
    typeof coordinates.lat === "number" &&
    typeof coordinates.lng === "number" &&
    Number.isFinite(coordinates.lat) &&
    Number.isFinite(coordinates.lng)
  );
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
  const [pendingNewInterest, setPendingNewInterest] =
    useState<PendingInterestSelection | null>(null);
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

  const handleMoveInterest = useCallback(
    (interestToMove?: Interest) => {
      const interest = interestToMove ?? selectedInterest;
      if (!interest || !centerMapFn) {
        return;
      }

      if (!hasValidCoordinates(interest.coordinates)) {
        console.error("Cannot move interest with invalid coordinates", {
          interest,
        });
        alert("Не успях да преместя зоната. Опитай пак.");
        return;
      }

      trackEvent({
        name: "zone_move_initiated",
        params: {
          zone_id: interest.id || "unknown",
          current_radius: interest.radius,
        },
      });

      // Center map on the interest so it stays in the same visual position
      centerMapFn(interest.coordinates.lat, interest.coordinates.lng, 17, {
        animate: false,
      });

      // Enter target mode with the interest being edited
      setTargetMode({
        active: true,
        initialRadius: interest.radius,
        editingInterestId: interest.id,
        pendingColor: interest.color,
      });

      // Close menu
      setInterestMenuPosition(null);
      setSelectedInterest(null);
    },
    [selectedInterest, centerMapFn],
  );

  const handleDeleteInterest = useCallback(
    async (interestToDelete?: Interest) => {
      const interest = interestToDelete ?? selectedInterest;
      if (!interest?.id) {
        console.error("Cannot delete interest without id", { interest });
        return;
      }

      try {
        trackEvent({
          name: "zone_deleted",
          params: {
            zone_id: interest.id,
            radius: interest.radius,
          },
        });
        await deleteInterest(interest.id);
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
    },
    [selectedInterest, deleteInterest],
  );

  const handleStartAddInterest = useCallback(
    (config?: { color?: string; radius?: number }) => {
      setPendingNewInterest(null);
      setTargetMode({
        active: true,
        initialRadius: config?.radius ?? 500,
        editingInterestId: null,
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

            // Exit target mode
            setTargetMode({ active: false });
          } else {
            // New interest uses two-step flow: first map selection, then metadata modal
            setPendingNewInterest({ coordinates, radius });
            setTargetMode({ active: false });
          }
        } catch (error) {
          console.error("Failed to save interest:", error);
          alert("Не успях да запазя зоната. Опитай пак.");
        }
      })();
    },
    [targetMode.editingInterestId, updateInterest],
  );

  const handleConfirmPendingInterest = useCallback(
    (metadata: { label?: string; color?: string }) => {
      if (!pendingNewInterest) {
        return;
      }

      (async () => {
        try {
          await addInterest(
            pendingNewInterest.coordinates,
            pendingNewInterest.radius,
            metadata,
          );
          setPendingNewInterest(null);
        } catch (error) {
          // Intentionally keep pendingNewInterest set so AddZoneModal stays
          // open and the user can retry without re-entering zone details.
          console.error("Failed to create interest:", error);
          alert("Не успях да запазя зоната. Опитай пак.");
        }
      })();
    },
    [addInterest, pendingNewInterest],
  );

  const handleCancelPendingInterest = useCallback(() => {
    setPendingNewInterest(null);
  }, []);

  const handleCancelTargetMode = useCallback(() => {
    setTargetMode({ active: false });
  }, []);

  const handleCloseInterestMenu = useCallback(() => {
    setInterestMenuPosition(null);
    setSelectedInterest(null);
  }, []);

  return {
    targetMode,
    pendingNewInterest,
    selectedInterest,
    interestMenuPosition,
    handleInterestClick,
    handleMoveInterest,
    handleDeleteInterest,
    handleStartAddInterest,
    handleSaveInterest,
    handleConfirmPendingInterest,
    handleCancelPendingInterest,
    handleCancelTargetMode,
    handleCloseInterestMenu,
  };
}
