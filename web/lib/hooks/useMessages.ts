import { useState, useCallback, useEffect, useMemo } from "react";
import { Message } from "@/lib/types";
import { buildMessagesUrl } from "./useMessages.utils";
import { debounce } from "@/lib/debounce";
import type { Category } from "@oboapp/shared";
import { CATEGORIES, UNCATEGORIZED } from "@oboapp/shared";

interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
  zoom: number;
}

/**
 * Custom hook for managing message fetching and viewport-based filtering
 *
 * Handles:
 * - Message fetching with viewport bounds and category filtering
 * - Loading and error states
 * - Debounced bounds changes (300ms)
 * - Message submission event listener
 */
export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(
    null,
  );
  const [selectedCategories, setSelectedCategories] = useState<Set<
    Category | typeof UNCATEGORIZED
  > | null>(null);

  // All categories are always available (predefined enum)
  // Memoize to prevent recreation on every render
  const availableCategories = useMemo<(Category | typeof UNCATEGORIZED)[]>(
    () => [...CATEGORIES, UNCATEGORIZED],
    [],
  );

  const fetchMessages = useCallback(
    async (
      bounds?: ViewportBounds | null,
      categories?: Set<Category | typeof UNCATEGORIZED> | null,
    ) => {
      try {
        setIsLoading(true);
        setError(null);

        // TODO: Migrate message fetching to react-query for caching and retries.

        // Build URL with optional categories
        let url = buildMessagesUrl(bounds);
        if (categories && categories.size > 0) {
          const categoriesParam = Array.from(categories).join(",");
          url = `${url}${bounds ? "&" : "?"}categories=${encodeURIComponent(categoriesParam)}`;
        }

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Failed to fetch messages");
        }

        const data = await response.json();
        setMessages(data.messages || []);
      } catch (err) {
        // Check if it's a network error (offline)
        if (!navigator.onLine) {
          setError(
            "Няма интернет връзка. Моля, свържете се към интернет и презаредете страницата.",
          );
        } else if (err instanceof TypeError && err.message.includes("fetch")) {
          setError(
            "Не успях да заредя сигналите. Проверете интернет връзката си и презаредете страницата.",
          );
        } else {
          setError("Не успях да заредя сигналите. Презареди страницата.");
        }
        console.error("Error fetching messages:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Handle map bounds change - debounced at 300ms
  const [handleBoundsChanged] = useState(() =>
    debounce((bounds: ViewportBounds) => setViewportBounds(bounds), 300),
  );

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      handleBoundsChanged.cancel();
    };
  }, [handleBoundsChanged]);

  // Fetch messages when viewport bounds or selected categories change
  useEffect(() => {
    if (viewportBounds) {
      fetchMessages(viewportBounds, selectedCategories);
    }
  }, [viewportBounds, selectedCategories, fetchMessages]);

  // Listen for message submission events
  useEffect(() => {
    const handleMessageSubmitted = () => {
      setTimeout(() => {
        fetchMessages(viewportBounds, selectedCategories);
      }, 2000);
    };

    globalThis.addEventListener("messageSubmitted", handleMessageSubmitted);

    return () => {
      globalThis.removeEventListener(
        "messageSubmitted",
        handleMessageSubmitted,
      );
    };
  }, [fetchMessages, viewportBounds, selectedCategories]);

  return {
    messages,
    availableCategories,
    isLoading,
    error,
    handleBoundsChanged,
    setSelectedCategories,
  };
}
