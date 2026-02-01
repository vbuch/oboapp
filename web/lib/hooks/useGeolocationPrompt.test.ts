import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGeolocationPrompt } from "./useGeolocationPrompt";

// Mock the analytics
vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

// Mock navigator.geolocation
const mockGetCurrentPosition = vi.fn();
const mockGeolocation = {
  getCurrentPosition: mockGetCurrentPosition,
};

Object.defineProperty(navigator, "geolocation", {
  value: mockGeolocation,
  writable: true,
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("useGeolocationPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);

    // Mock alert function
    Object.defineProperty(window, "alert", {
      value: vi.fn(),
      writable: true,
    });
  });

  it("should initialize with correct default state", () => {
    const { result } = renderHook(() => useGeolocationPrompt());

    expect(result.current.showPrompt).toBe(false);
    expect(result.current.isLocating).toBe(false);
    expect(typeof result.current.requestGeolocation).toBe("function");
    expect(typeof result.current.hidePrompt).toBe("function");
  });

  it("should show prompt when no cached permission exists", async () => {
    const { result } = renderHook(() => useGeolocationPrompt());
    const mockCenterMap = vi.fn();

    localStorageMock.getItem.mockReturnValue("false");

    await act(async () => {
      result.current.requestGeolocation(mockCenterMap);
    });

    expect(result.current.showPrompt).toBe(true);
  });

  it("should directly get location when permission is cached", async () => {
    const { result } = renderHook(() => useGeolocationPrompt());
    const mockCenterMap = vi.fn();

    localStorageMock.getItem.mockReturnValue("true");
    mockGetCurrentPosition.mockImplementation((success) => {
      success({
        coords: {
          latitude: 42.6977,
          longitude: 23.3219,
        },
      });
    });

    await act(async () => {
      await result.current.requestGeolocation(mockCenterMap);
    });

    expect(mockCenterMap).toHaveBeenCalledWith(42.6977, 23.3219, 17, {
      animate: true,
    });
    expect(result.current.showPrompt).toBe(false);
  });

  it("should handle geolocation errors gracefully", async () => {
    const { result } = renderHook(() => useGeolocationPrompt());
    const mockCenterMap = vi.fn();
    const alertSpy = vi.spyOn(window, "alert");

    localStorageMock.getItem.mockReturnValue("true");
    mockGetCurrentPosition.mockImplementation((success, error) => {
      error({
        code: 1, // PERMISSION_DENIED
        message: "Permission denied",
      });
    });

    await act(async () => {
      try {
        await result.current.requestGeolocation(mockCenterMap);
      } catch {
        // Expected to throw
      }
    });

    expect(alertSpy).toHaveBeenCalled();
    expect(mockCenterMap).not.toHaveBeenCalled();
  });

  it("should hide prompt when hidePrompt is called", () => {
    const { result } = renderHook(() => useGeolocationPrompt());

    act(() => {
      // Simulate showing prompt
      result.current.requestGeolocation(vi.fn());
    });

    act(() => {
      result.current.hidePrompt();
    });

    expect(result.current.showPrompt).toBe(false);
  });
});
