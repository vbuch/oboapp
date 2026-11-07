"use client";

import { useCallback, useSyncExternalStore } from "react";

export type LandingView = "events" | "zones";

const STORAGE_KEY = "landingViewPreference:v1";
const CHANGE_EVENT = "landing-view-preference-changed";

function readPreference(): LandingView | null {
  try {
    const stored = globalThis.localStorage.getItem(STORAGE_KEY);
    return stored === "events" || stored === "zones" ? stored : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      onChange();
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(CHANGE_EVENT, onChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function getServerSnapshot(): undefined {
  return undefined;
}

/** Browser-local preference, loaded after hydration before choosing a home view. */
export function useLandingPreference() {
  const preference = useSyncExternalStore<LandingView | null | undefined>(
    subscribe,
    readPreference,
    getServerSnapshot,
  );

  const setPreferredLandingView = useCallback((view: LandingView): boolean => {
    try {
      globalThis.localStorage.setItem(STORAGE_KEY, view);
      window.dispatchEvent(new Event(CHANGE_EVENT));
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    preferredLandingView: preference ?? null,
    isLoading: preference === undefined,
    setPreferredLandingView,
  };
}
