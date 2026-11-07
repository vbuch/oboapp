import { act, cleanup, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLandingPreference } from "./useLandingPreference";

const STORAGE_KEY = "landingViewPreference:v1";

describe("useLandingPreference", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps an unset preference without saving a default", () => {
    const { result } = renderHook(() => useLandingPreference());

    expect(result.current.preferredLandingView).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it.each(["events", "zones"] as const)(
    "restores the saved %s choice on a returning visit",
    (view) => {
      const firstVisit = renderHook(() => useLandingPreference());

      act(() => {
        expect(firstVisit.result.current.setPreferredLandingView(view)).toBe(true);
      });
      firstVisit.unmount();

      const returningVisit = renderHook(() => useLandingPreference());

      expect(returningVisit.result.current.preferredLandingView).toBe(view);
    },
  );

  it("updates other mounted consumers when the setting changes", () => {
    const settings = renderHook(() => useLandingPreference());
    const home = renderHook(() => useLandingPreference());

    act(() => {
      settings.result.current.setPreferredLandingView("zones");
    });

    expect(settings.result.current.preferredLandingView).toBe("zones");
    expect(home.result.current.preferredLandingView).toBe("zones");
  });

  it("receives changes and cleared preferences from another browser tab", () => {
    const { result } = renderHook(() => useLandingPreference());

    act(() => {
      localStorage.setItem(STORAGE_KEY, "zones");
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    });
    expect(result.current.preferredLandingView).toBe("zones");

    act(() => {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(result.current.preferredLandingView).toBeNull();
  });

  it("ignores unsupported saved values", () => {
    localStorage.setItem(STORAGE_KEY, "invalid");

    const { result } = renderHook(() => useLandingPreference());

    expect(result.current.preferredLandingView).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("reports a failed save and preserves the previous preference", () => {
    localStorage.setItem(STORAGE_KEY, "events");
    const { result } = renderHook(() => useLandingPreference());
    const storedValues = localStorage;
    vi.stubGlobal("localStorage", {
      getItem: storedValues.getItem.bind(storedValues),
      setItem: () => {
        throw new Error("Storage unavailable");
      },
    });

    act(() => {
      expect(result.current.setPreferredLandingView("zones")).toBe(false);
    });

    expect(result.current.preferredLandingView).toBe("events");
  });

  it("preserves the default view when browser storage cannot be read", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("Storage unavailable");
      },
    });

    const { result } = renderHook(() => useLandingPreference());

    expect(result.current.preferredLandingView).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("waits for the client preference during server rendering", () => {
    localStorage.setItem(STORAGE_KEY, "zones");
    const getItem = vi.fn();
    vi.stubGlobal("localStorage", { getItem });

    function ServerPreference() {
      const { isLoading, preferredLandingView } = useLandingPreference();
      return <span>{isLoading ? "loading" : preferredLandingView}</span>;
    }

    expect(renderToString(<ServerPreference />)).toBe("<span>loading</span>");
    expect(getItem).not.toHaveBeenCalled();
  });
});
