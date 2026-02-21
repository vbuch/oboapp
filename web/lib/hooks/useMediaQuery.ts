import { useEffect, useState } from "react";

/**
 * Custom hook to reactively track if viewport matches a media query
 * @param query Media query string (e.g., "(max-width: 640px)")
 * @returns boolean indicating if the media query matches
 */
export function useMediaQuery(query: string): boolean {
  // Initialize with correct value on client side to avoid flash
  const [matches, setMatches] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(query);
    
    // Update state to match current value (may have changed since init)
    setMatches(mediaQuery.matches);

    // Create event listener for changes
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add listener (use deprecated addListener for older browsers)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handler);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handler);
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handler);
      } else {
        // Fallback for older browsers
        mediaQuery.removeListener(handler);
      }
    };
  }, [query]);

  return matches;
}

/**
 * Hook to check if viewport is mobile size (< 640px)
 */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 639px)");
}
