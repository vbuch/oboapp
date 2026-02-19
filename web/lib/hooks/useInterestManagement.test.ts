import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useInterestManagement } from "./useInterestManagement";
import type { Interest } from "@/lib/types";

type CenterMapFn = (
  lat: number,
  lng: number,
  zoom?: number,
  options?: { animate?: boolean },
) => void;

// Mock analytics
vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

// Helper to create mock Interest
const createMockInterest = (overrides: Partial<Interest> = {}): Interest => ({
  id: "test-id",
  userId: "test-user",
  coordinates: { lat: 42.7, lng: 23.3 },
  radius: 500,
  createdAt: "2024-01-01",
  updatedAt: new Date("2024-01-01"),
  ...overrides,
});

describe("useInterestManagement", () => {
  let centerMapFn: Mock<CenterMapFn>;
  let mapInstance: google.maps.Map | null;
  let addInterest: Mock<
    (coordinates: { lat: number; lng: number }, radius: number) => Promise<void>
  >;
  let updateInterest: Mock<
    (
      id: string,
      updates: { coordinates?: { lat: number; lng: number }; radius?: number },
    ) => Promise<void>
  >;
  let deleteInterest: Mock<(id: string) => Promise<void>>;
  let originalInnerWidth: number;
  let originalInnerHeight: number;
  let mockAlert: typeof globalThis.alert;
  let mockReload: () => void;

  beforeEach(() => {
    centerMapFn = vi.fn();
    mapInstance = null; // Default to null for most tests
    addInterest = vi.fn().mockResolvedValue(undefined);
    updateInterest = vi.fn().mockResolvedValue(undefined);
    deleteInterest = vi.fn().mockResolvedValue(undefined);

    // Mock window dimensions
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 768,
    });

    // Mock alert and reload
    mockAlert = vi.fn() as any;
    mockReload = vi.fn() as any;
    globalThis.alert = mockAlert;
    Object.defineProperty(globalThis.location, "reload", {
      writable: true,
      configurable: true,
      value: mockReload,
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore window dimensions
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

  describe("initial state", () => {
    it("should initialize with default state", () => {
      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      expect(result.current.targetMode).toEqual({ active: false });
      expect(result.current.selectedInterest).toBeNull();
      expect(result.current.interestMenuPosition).toBeNull();
    });
  });

  describe("handleInterestClick", () => {
    it("should set selected interest and show menu at center", () => {
      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      const mockInterest = createMockInterest();

      act(() => {
        result.current.handleInterestClick(mockInterest);
      });

      expect(result.current.selectedInterest).toEqual(mockInterest);
      expect(result.current.interestMenuPosition).toEqual({
        x: 512, // 1024 / 2
        y: 384, // 768 / 2
      });
    });
  });

  describe("handleMoveInterest", () => {
    it("should do nothing if no selected interest", () => {
      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      act(() => {
        result.current.handleMoveInterest();
      });

      expect(centerMapFn).not.toHaveBeenCalled();
      expect(result.current.targetMode.active).toBe(false);
    });

    it("should do nothing if centerMapFn is null", () => {
      const { result } = renderHook(() =>
        useInterestManagement(
          null,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      const mockInterest = createMockInterest();

      act(() => {
        result.current.handleInterestClick(mockInterest);
      });

      act(() => {
        result.current.handleMoveInterest();
      });

      expect(result.current.targetMode.active).toBe(false);
    });

    it("should center map and enter target mode when moving interest", async () => {
      const { trackEvent } = await import("@/lib/analytics");

      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      const mockInterest = createMockInterest();

      act(() => {
        result.current.handleInterestClick(mockInterest);
      });

      act(() => {
        result.current.handleMoveInterest();
      });

      expect(centerMapFn).toHaveBeenCalledWith(42.7, 23.3, 17, {
        animate: false,
      });
      expect(result.current.targetMode).toEqual({
        active: true,
        initialRadius: 500,
        editingInterestId: "test-id",
      });
      expect(result.current.interestMenuPosition).toBeNull();
      expect(result.current.selectedInterest).toBeNull();
      expect(trackEvent).toHaveBeenCalledWith({
        name: "zone_move_initiated",
        params: {
          zone_id: "test-id",
          current_radius: 500,
        },
      });
    });
  });

  describe("handleDeleteInterest", () => {
    it("should do nothing if no selected interest", async () => {
      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      await act(async () => {
        await result.current.handleDeleteInterest();
      });

      expect(deleteInterest).not.toHaveBeenCalled();
    });

    it("should delete interest and clear menu", async () => {
      const { trackEvent } = await import("@/lib/analytics");

      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      const mockInterest = createMockInterest();

      act(() => {
        result.current.handleInterestClick(mockInterest);
      });

      await act(async () => {
        await result.current.handleDeleteInterest();
      });

      expect(deleteInterest).toHaveBeenCalledWith("test-id");
      expect(result.current.interestMenuPosition).toBeNull();
      expect(result.current.selectedInterest).toBeNull();
      expect(trackEvent).toHaveBeenCalledWith({
        name: "zone_deleted",
        params: {
          zone_id: "test-id",
          radius: 500,
        },
      });
    });

    it("should handle 404 error gracefully and reload", async () => {
      deleteInterest.mockRejectedValue(new Error("404 Not Found"));

      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      const mockInterest = createMockInterest();

      act(() => {
        result.current.handleInterestClick(mockInterest);
      });

      await act(async () => {
        await result.current.handleDeleteInterest();
      });

      expect(result.current.interestMenuPosition).toBeNull();
      expect(result.current.selectedInterest).toBeNull();
      expect(mockReload).toHaveBeenCalled();
      expect(mockAlert).not.toHaveBeenCalled();
    });

    it("should show alert for non-404 errors", async () => {
      deleteInterest.mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      const mockInterest = createMockInterest();

      act(() => {
        result.current.handleInterestClick(mockInterest);
      });

      await act(async () => {
        await result.current.handleDeleteInterest();
      });

      expect(mockAlert).toHaveBeenCalledWith(
        "Не успях да изтрия зоната. Опитай пак.",
      );
      expect(mockReload).not.toHaveBeenCalled();
    });
  });

  describe("handleStartAddInterest", () => {
    it("should enter target mode with default radius", () => {
      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      act(() => {
        result.current.handleStartAddInterest();
      });

      expect(result.current.targetMode).toEqual({
        active: true,
        initialRadius: 500,
        editingInterestId: null,
      });
    });
  });

  describe("handleSaveInterest", () => {
    it("should add new interest when not editing", async () => {
      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      act(() => {
        result.current.handleStartAddInterest();
      });

      const coordinates = { lat: 42.7, lng: 23.3 };
      const radius = 500;

      act(() => {
        result.current.handleSaveInterest(coordinates, radius);
      });

      await waitFor(() => {
        expect(addInterest).toHaveBeenCalledWith(coordinates, radius, {
          label: undefined,
          color: undefined,
        });
      });

      await waitFor(() => {
        expect(result.current.targetMode.active).toBe(false);
      });

      expect(updateInterest).not.toHaveBeenCalled();
    });

    it("should update existing interest when editing", async () => {
      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      const mockInterest = createMockInterest();

      act(() => {
        result.current.handleInterestClick(mockInterest);
      });

      act(() => {
        result.current.handleMoveInterest();
      });

      const newCoordinates = { lat: 42.8, lng: 23.4 };
      const newRadius = 600;

      act(() => {
        result.current.handleSaveInterest(newCoordinates, newRadius);
      });

      await waitFor(() => {
        expect(updateInterest).toHaveBeenCalledWith("test-id", {
          coordinates: newCoordinates,
          radius: newRadius,
        });
      });

      await waitFor(() => {
        expect(result.current.targetMode.active).toBe(false);
      });

      expect(addInterest).not.toHaveBeenCalled();
    });

    it("should show alert when adding interest fails", async () => {
      addInterest.mockRejectedValue(new Error("Failed to add"));

      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      act(() => {
        result.current.handleStartAddInterest();
      });

      const coordinates = { lat: 42.7, lng: 23.3 };
      const radius = 500;

      act(() => {
        result.current.handleSaveInterest(coordinates, radius);
      });

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          "Не успях да запазя зоната. Опитай пак.",
        );
      });
    });

    it("should show alert when updating interest fails", async () => {
      updateInterest.mockRejectedValue(new Error("Failed to update"));

      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      const mockInterest = createMockInterest();

      act(() => {
        result.current.handleInterestClick(mockInterest);
      });

      act(() => {
        result.current.handleMoveInterest();
      });

      const newCoordinates = { lat: 42.8, lng: 23.4 };
      const newRadius = 600;

      act(() => {
        result.current.handleSaveInterest(newCoordinates, newRadius);
      });

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          "Не успях да запазя зоната. Опитай пак.",
        );
      });
    });
  });

  describe("handleCancelTargetMode", () => {
    it("should exit target mode", () => {
      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      act(() => {
        result.current.handleStartAddInterest();
      });

      expect(result.current.targetMode.active).toBe(true);

      act(() => {
        result.current.handleCancelTargetMode();
      });

      expect(result.current.targetMode.active).toBe(false);
    });
  });

  describe("handleCloseInterestMenu", () => {
    it("should clear menu and selected interest", () => {
      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      const mockInterest = createMockInterest();

      act(() => {
        result.current.handleInterestClick(mockInterest);
      });

      expect(result.current.selectedInterest).not.toBeNull();
      expect(result.current.interestMenuPosition).not.toBeNull();

      act(() => {
        result.current.handleCloseInterestMenu();
      });

      expect(result.current.selectedInterest).toBeNull();
      expect(result.current.interestMenuPosition).toBeNull();
    });
  });

  describe("state transitions", () => {
    it("should handle complete add interest flow", async () => {
      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      // Start adding interest
      act(() => {
        result.current.handleStartAddInterest();
      });
      expect(result.current.targetMode).toEqual({
        active: true,
        initialRadius: 500,
        editingInterestId: null,
      });

      // Save interest
      act(() => {
        result.current.handleSaveInterest({ lat: 42.7, lng: 23.3 }, 500);
      });

      await waitFor(() => {
        expect(result.current.targetMode.active).toBe(false);
      });
    });

    it("should handle complete move interest flow", async () => {
      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      const mockInterest = createMockInterest();

      // Click interest
      act(() => {
        result.current.handleInterestClick(mockInterest);
      });

      // Start moving
      act(() => {
        result.current.handleMoveInterest();
      });
      expect(result.current.targetMode.editingInterestId).toBe("test-id");

      // Save new position
      act(() => {
        result.current.handleSaveInterest({ lat: 42.8, lng: 23.4 }, 600);
      });

      await waitFor(() => {
        expect(result.current.targetMode.active).toBe(false);
      });
    });

    it("should handle cancel during add interest", () => {
      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      act(() => {
        result.current.handleStartAddInterest();
      });

      act(() => {
        result.current.handleCancelTargetMode();
      });

      expect(result.current.targetMode.active).toBe(false);
      expect(addInterest).not.toHaveBeenCalled();
    });

    it("should handle cancel during move interest", () => {
      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      const mockInterest = createMockInterest();

      act(() => {
        result.current.handleInterestClick(mockInterest);
      });

      act(() => {
        result.current.handleMoveInterest();
      });

      act(() => {
        result.current.handleCancelTargetMode();
      });

      expect(result.current.targetMode.active).toBe(false);
      expect(updateInterest).not.toHaveBeenCalled();
    });
  });
});
