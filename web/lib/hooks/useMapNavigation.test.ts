import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMapNavigation } from "./useMapNavigation";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

describe("useMapNavigation", () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    vi.useFakeTimers();
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;

    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 390,
    });

    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 800,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
  });

  it("clears pending mobile pan before scheduling a new one", () => {
    const centerMap = vi.fn();
    const panBy = vi.fn();
    const map = { panBy } as unknown as google.maps.Map;

    const { result } = renderHook(() => useMapNavigation());

    act(() => {
      result.current.handleMapReady(centerMap, map);
    });

    act(() => {
      result.current.handleAddressClick(42.7, 23.3);
      result.current.handleAddressClick(42.71, 23.31);
    });

    act(() => {
      vi.runAllTimers();
    });

    expect(centerMap).toHaveBeenCalledTimes(2);
    expect(panBy).toHaveBeenCalledTimes(1);
    expect(panBy).toHaveBeenCalledWith(0, 160);
  });

  it("clears pending mobile pan timeout on unmount", () => {
    const centerMap = vi.fn();
    const panBy = vi.fn();
    const map = { panBy } as unknown as google.maps.Map;

    const { result, unmount } = renderHook(() => useMapNavigation());

    act(() => {
      result.current.handleMapReady(centerMap, map);
      result.current.handleAddressClick(42.7, 23.3);
    });

    unmount();

    act(() => {
      vi.runAllTimers();
    });

    expect(panBy).not.toHaveBeenCalled();
  });
});
