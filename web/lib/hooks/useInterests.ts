"use client";

import { useState, useEffect, useCallback } from "react";
import { Interest } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { trackEvent } from "@/lib/analytics";
import { fetchWithAuth } from "@/lib/auth-fetch";

export function useInterests() {
  const { user, loading: authLoading } = useAuth();
  const [interests, setInterests] = useState<Interest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch interests for the current user
  // Wait for auth to settle before initializing to avoid flash
  const fetchInterests = useCallback(async () => {
    // Don't initialize until auth state is determined
    if (authLoading) {
      return;
    }

    if (!user) {
      setInterests([]);
      setIsLoading(false);
      setHasInitialized(true);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetchWithAuth(user, "/api/interests");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Failed to fetch interests:", response.status, errorData);
        throw new Error(
          `Failed to fetch interests: ${response.status} - ${
            errorData.error || "Unknown error"
          }`,
        );
      }

      const data = await response.json();
      const fetchedInterests = data.interests || [];

      // Check for duplicates from API
      const ids = fetchedInterests.map((i: Interest) => i.id);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
        console.error("[useInterests] API returned duplicate interests!", {
          total: ids.length,
          unique: uniqueIds.size,
        });
      }

      // Deduplicate by ID (defensive)
      const deduped = fetchedInterests.filter(
        (interest: Interest, index: number, self: Interest[]) =>
          index === self.findIndex((i) => i.id === interest.id),
      );

      if (deduped.length !== fetchedInterests.length) {
        console.warn(
          "[useInterests] Removed",
          fetchedInterests.length - deduped.length,
          "duplicate interests",
        );
      }

      setInterests(deduped);
    } catch (err) {
      console.error("Error fetching interests:", err);
      // Check if offline
      if (!navigator.onLine) {
        setError("Няма интернет връзка. Свържи се с интернет.");
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to load interests",
        );
      }
    } finally {
      setIsLoading(false);
      setHasInitialized(true);
    }
  }, [user, authLoading]);

  // Add a new interest
  const addInterest = useCallback(
    async (
      coordinates: { lat: number; lng: number },
      radius: number = 500,
      metadata?: { label?: string; color?: string },
    ) => {
      if (!user) {
        throw new Error("Must be logged in to add interests");
      }

      try {
        const response = await fetchWithAuth(user, "/api/interests", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ coordinates, radius, ...metadata }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("[addInterest] Failed:", response.status, errorData);
          throw new Error(
            `Failed to add interest: ${response.status} - ${
              errorData.error || "Unknown error"
            }`,
          );
        }

        const data = await response.json();

        // Check if this interest already exists in the array (prevent duplicates)
        setInterests((prev) => {
          const exists = prev.some((i) => i.id === data.interest.id);
          if (exists) {
            return prev;
          }
          return [data.interest, ...prev];
        });

        if (user.isAnonymous) {
          trackEvent({
            name: "guest_zone_created",
            params: { radius },
          });
        }

        return data.interest;
      } catch (err) {
        console.error("Error adding interest:", err);
        // Provide helpful error message for offline state
        if (!navigator.onLine) {
          throw new Error(
            "Няма интернет връзка. Свържи се с интернет и опитай отново.",
          );
        }
        throw err;
      }
    },
    [user],
  );

  // Update an existing interest (move or change radius)
  const updateInterest = useCallback(
    async (
      id: string,
      updates: {
        coordinates?: { lat: number; lng: number };
        radius?: number;
      },
    ) => {
      if (!user) {
        throw new Error("Must be logged in to update interests");
      }

      try {
        const response = await fetchWithAuth(user, "/api/interests", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id, ...updates }),
        });

        if (!response.ok) {
          throw new Error("Failed to update interest");
        }

        const data = await response.json();
        setInterests((prev) =>
          prev.map((interest) =>
            interest.id === id ? data.interest : interest,
          ),
        );
        return data.interest;
      } catch (err) {
        console.error("Error updating interest:", err);
        // Provide helpful error message for offline state
        if (!navigator.onLine) {
          throw new Error(
            "Няма интернет връзка. Свържи се с интернет и опитай отново.",
          );
        }
        throw err;
      }
    },
    [user],
  );

  // Delete an interest
  const deleteInterest = useCallback(
    async (id: string) => {
      if (!user) {
        throw new Error("Must be logged in to delete interests");
      }

      try {
        const response = await fetchWithAuth(user, `/api/interests?id=${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("[deleteInterest] Failed:", response.status, errorData);
          throw new Error(
            `Failed to delete interest: ${response.status} - ${
              errorData.error || "Unknown error"
            }`,
          );
        }

        setInterests((prev) => prev.filter((interest) => interest.id !== id));
      } catch (err) {
        console.error("Error deleting interest:", err);
        // Provide helpful error message for offline state
        if (!navigator.onLine) {
          throw new Error(
            "Няма интернет връзка. Свържи се с интернет и опитай отново.",
          );
        }
        throw err;
      }
    },
    [user],
  );

  // Fetch interests when user logs in
  useEffect(() => {
    fetchInterests();
  }, [fetchInterests]);

  return {
    interests,
    isLoading,
    hasInitialized,
    error,
    addInterest,
    updateInterest,
    deleteInterest,
    refreshInterests: fetchInterests,
  };
}
