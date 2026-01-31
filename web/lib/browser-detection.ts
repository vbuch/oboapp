/**
 * Browser detection utilities for determining appropriate authentication methods
 */

/**
 * Detects if the current browser is Safari on iOS or iPadOS
 * 
 * Safari on iOS has strict popup blocking that prevents OAuth popups
 * from working reliably, especially when opened from async handlers.
 * 
 * @returns true if running on Safari iOS/iPadOS, false otherwise
 */
export function isSafariMobile(): boolean {
  if (typeof window === "undefined" || !window.navigator) {
    return false;
  }

  const ua = window.navigator.userAgent;
  
  // Check for iOS devices (iPhone, iPad, iPod)
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  
  // Check for Safari (but not Chrome or other browsers on iOS)
  // iOS browsers are required to use WebKit, but we specifically want Safari
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  
  return isIOS && isSafari;
}

/**
 * Detects if the current browser is Microsoft Edge (Chromium-based)
 * 
 * Edge has popup blocking issues similar to Safari, especially
 * when popups are opened from async handlers.
 * 
 * @returns true if running on Edge, false otherwise
 */
export function isEdge(): boolean {
  if (typeof window === "undefined" || !window.navigator) {
    return false;
  }

  const ua = window.navigator.userAgent;
  
  // Chromium-based Edge uses "Edg/" (desktop), "EdgA/" (Android), or "EdgiOS/" (iOS)
  return /Edg\/|EdgA\/|EdgiOS\//.test(ua);
}

/**
 * Detects if the current browser should use redirect-based OAuth
 * instead of popup-based OAuth.
 * 
 * Redirect mode is preferred for:
 * - Mobile devices (better UX, no popup blocking)
 * - Safari on iOS (popup blocking issues)
 * - Microsoft Edge (popup blocking issues)
 * 
 * @returns true if redirect mode should be used, false for popup mode
 */
export function shouldUseRedirectAuth(): boolean {
  if (typeof window === "undefined" || !window.navigator) {
    return false;
  }

  // Always use redirect on Safari iOS
  if (isSafariMobile()) {
    return true;
  }

  // Always use redirect on Edge (all platforms)
  if (isEdge()) {
    return true;
  }

  // Check if on any mobile device
  const ua = window.navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  
  return isMobile;
}
