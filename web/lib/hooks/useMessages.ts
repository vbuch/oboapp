import { useState, useCallback, useEffect, useRef } from "react";
import { Message } from "@/lib/types";
import { buildMessagesUrl } from "./useMessages.utils";

interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Custom hook for managing message fetching and viewport-based filtering
 *
 * Handles:
 * - Message fetching with viewport bounds
 * - Loading and error states
 * - Debounced bounds changes (300ms)
 * - Message submission event listener
 */
export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(
    null
  );
  const boundsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMessages = useCallback(async (bounds?: ViewportBounds | null) => {
    try {
      setIsLoading(true);
      setError(null);

      const url = buildMessagesUrl(bounds);

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
          "Няма интернет връзка. Моля, свържете се към интернет и презаредете страницата."
        );
      } else if (err instanceof TypeError && err.message.includes("fetch")) {
        setError(
          "Не успях да заредя сигналите. Проверете интернет връзката си и презаредете страницата."
        );
      } else {
        setError("Не успях да заредя сигналите. Презареди страницата.");
      }
      console.error("Error fetching messages:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle map bounds change - debounced at 300ms
  const handleBoundsChanged = useCallback((bounds: ViewportBounds) => {
    // Clear existing timeout
    if (boundsTimeoutRef.current) {
      clearTimeout(boundsTimeoutRef.current);
    }

    // Set new timeout for debounced fetch
    boundsTimeoutRef.current = setTimeout(() => {
      setViewportBounds(bounds);
    }, 300);
  }, []);

  // Fetch messages when viewport bounds change
  useEffect(() => {
    if (viewportBounds) {
      fetchMessages(viewportBounds);
    }
  }, [viewportBounds, fetchMessages]);

  // Listen for message submission events
  useEffect(() => {
    const handleMessageSubmitted = () => {
      setTimeout(() => {
        fetchMessages(viewportBounds);
      }, 2000);
    };

    globalThis.addEventListener("messageSubmitted", handleMessageSubmitted);

    return () => {
      globalThis.removeEventListener(
        "messageSubmitted",
        handleMessageSubmitted
      );
    };
  }, [fetchMessages, viewportBounds]);

  return {
    messages,
    isLoading,
    error,
    handleBoundsChanged,
  };
}
