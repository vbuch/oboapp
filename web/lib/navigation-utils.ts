/**
 * Utility functions for navigation and browser history management
 */

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * Navigates back in browser history if available, otherwise replaces current URL
 * 
 * This helper prevents polluting browser history with duplicate entries when
 * closing modal overlays. If the user has history to go back to (e.g., came from
 * another page or opened a detail), we navigate back. Otherwise (e.g., direct link
 * to a detail page), we replace the current URL with the fallback.
 * 
 * @param router - Next.js App Router instance from useRouter()
 * @param fallbackUrl - URL to navigate to if no history is available
 * 
 * @example
 * // In a modal close handler
 * const handleClose = () => {
 *   navigateBackOrReplace(router, "/");
 * };
 */
export function navigateBackOrReplace(
  router: AppRouterInstance,
  fallbackUrl: string,
): void {
  // Check if we can go back (history.length > 1 means there's a previous entry)
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
  } else {
    // Fallback for cases where there's no history (e.g., direct link to detail)
    router.replace(fallbackUrl, { scroll: false });
  }
}
