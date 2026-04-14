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
import { DEFAULT_ZONE_COLOR } from "@/lib/zoneTypes";

const { toastMock } = vi.hoisted(() => ({
  toastMock: {
    error: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

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
    (
      coordinates: { lat: number; lng: number },
      radius: number,
      metadata?: { label?: string; color?: string },
    ) => Promise<void>
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

    // Mock reload
    mockReload = vi.fn() as any;
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
      expect(result.current.pendingNewInterest).toBeNull();
      expect(result.current.pendingDeleteInterest).toBeNull();
      expect(result.current.isDeletingInterest).toBe(false);
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
      expect(result.current.targetMode).toEqual(
        expect.objectContaining({
          active: true,
          initialRadius: 500,
          editingInterestId: "test-id",
        }),
      );
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

    it("should move a provided interest without requiring prior selection", () => {
      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      const mockInterest = createMockInterest({ id: "from-list" });

      act(() => {
        result.current.handleMoveInterest(mockInterest);
      });

      expect(centerMapFn).toHaveBeenCalledWith(42.7, 23.3, 17, {
        animate: false,
      });
      expect(result.current.targetMode).toEqual(
        expect.objectContaining({
          active: true,
          editingInterestId: "from-list",
        }),
      );
    });

    it("should not crash when moving interest with invalid coordinates", () => {
      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      const invalidInterest = {
        ...createMockInterest({ id: "invalid-coordinates" }),
        coordinates: undefined,
      } as unknown as Interest;

      act(() => {
        result.current.handleMoveInterest(invalidInterest);
      });

      expect(centerMapFn).not.toHaveBeenCalled();
      expect(result.current.targetMode.active).toBe(false);
      expect(toastMock.error).toHaveBeenCalledWith(
        "Не успях да преместя зоната. Опитай пак.",
      );
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

      act(() => {
        result.current.handleDeleteInterest();
      });

      expect(deleteInterest).not.toHaveBeenCalled();
    });

    it("should request delete confirmation and delete after confirm", async () => {
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
        result.current.handleDeleteInterest();
      });

      expect(result.current.pendingDeleteInterest?.id).toBe("test-id");

      await act(async () => {
        await result.current.handleConfirmDeleteInterest();
      });

      expect(deleteInterest).toHaveBeenCalledWith("test-id");
      expect(result.current.interestMenuPosition).toBeNull();
      expect(result.current.selectedInterest).toBeNull();
      expect(result.current.pendingDeleteInterest).toBeNull();
      expect(trackEvent).toHaveBeenCalledWith({
        name: "zone_deleted",
        params: {
          zone_id: "test-id",
          radius: 500,
        },
      });
    });

    it("should delete a provided interest after explicit confirm", async () => {
      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      const mockInterest = createMockInterest({ id: "from-list-delete" });

      act(() => {
        result.current.handleDeleteInterest(mockInterest);
      });

      expect(result.current.pendingDeleteInterest?.id).toBe("from-list-delete");

      await act(async () => {
        await result.current.handleConfirmDeleteInterest();
      });

      expect(deleteInterest).toHaveBeenCalledWith("from-list-delete");
      expect(result.current.selectedInterest).toBeNull();
      expect(result.current.interestMenuPosition).toBeNull();
      expect(result.current.pendingDeleteInterest).toBeNull();
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

      act(() => {
        result.current.handleDeleteInterest();
      });

      await act(async () => {
        await result.current.handleConfirmDeleteInterest();
      });

      expect(result.current.interestMenuPosition).toBeNull();
      expect(result.current.selectedInterest).toBeNull();
      expect(mockReload).toHaveBeenCalled();
      expect(toastMock.error).not.toHaveBeenCalled();
    });

    it("should show toast for non-404 errors", async () => {
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

      act(() => {
        result.current.handleDeleteInterest();
      });

      await act(async () => {
        await result.current.handleConfirmDeleteInterest();
      });

      expect(toastMock.error).toHaveBeenCalledWith(
        "Не успях да изтрия зоната. Опитай пак.",
      );
      expect(mockReload).not.toHaveBeenCalled();
      expect(result.current.pendingDeleteInterest?.id).toBe("test-id");
    });

    it("should clear pending delete when cancelled", async () => {
      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      const mockInterest = createMockInterest({ id: "cancel-delete" });

      act(() => {
        result.current.handleDeleteInterest(mockInterest);
      });

      expect(result.current.pendingDeleteInterest?.id).toBe("cancel-delete");

      act(() => {
        result.current.handleCancelDeleteInterest();
      });

      expect(result.current.pendingDeleteInterest).toBeNull();
      expect(deleteInterest).not.toHaveBeenCalled();
    });

    it("should ignore duplicate confirm while delete is in flight", async () => {
      let resolveDelete: (() => void) | undefined;
      deleteInterest.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveDelete = resolve;
          }),
      );

      const { result } = renderHook(() =>
        useInterestManagement(
          centerMapFn,
          mapInstance,
          addInterest,
          updateInterest,
          deleteInterest,
        ),
      );

      const mockInterest = createMockInterest({ id: "dup-confirm" });

      act(() => {
        result.current.handleDeleteInterest(mockInterest);
      });

      expect(result.current.pendingDeleteInterest?.id).toBe("dup-confirm");

      act(() => {
        void result.current.handleConfirmDeleteInterest();
      });

      expect(result.current.isDeletingInterest).toBe(true);

      act(() => {
        void result.current.handleConfirmDeleteInterest();
      });

      expect(deleteInterest).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.handleCancelDeleteInterest();
      });

      expect(result.current.pendingDeleteInterest?.id).toBe("dup-confirm");

      await act(async () => {
        resolveDelete?.();
      });

      await waitFor(() => {
        expect(result.current.isDeletingInterest).toBe(false);
      });
      expect(result.current.pendingDeleteInterest).toBeNull();
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

      expect(result.current.targetMode).toEqual(
        expect.objectContaining({
          active: true,
          initialRadius: 500,
          editingInterestId: null,
        }),
      );
    });
  });

  describe("handleSaveInterest", () => {
    it("should store pending selection when not editing", async () => {
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
        expect(result.current.pendingNewInterest).toEqual({
          coordinates,
          radius,
        });
      });

      await waitFor(() => {
        expect(result.current.targetMode.active).toBe(false);
      });

      expect(addInterest).not.toHaveBeenCalled();
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

    it("should show toast when updating interest fails", async () => {
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
        expect(toastMock.error).toHaveBeenCalledWith(
          "Не успях да запазя зоната. Опитай пак.",
        );
      });
    });
  });

  describe("handleConfirmPendingInterest", () => {
    it("should add new interest with metadata and clear pending selection", async () => {
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

      act(() => {
        result.current.handleConfirmPendingInterest({
          label: "Вкъщи",
          color: DEFAULT_ZONE_COLOR,
        });
      });

      await waitFor(() => {
        expect(addInterest).toHaveBeenCalledWith(coordinates, radius, {
          label: "Вкъщи",
          color: DEFAULT_ZONE_COLOR,
        });
      });

      await waitFor(() => {
        expect(result.current.pendingNewInterest).toBeNull();
      });
    });

    it("should do nothing when there is no pending selection", () => {
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
        result.current.handleConfirmPendingInterest({ label: "Тест" });
      });

      expect(addInterest).not.toHaveBeenCalled();
    });

    it("should show toast when adding interest fails", async () => {
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

      act(() => {
        result.current.handleConfirmPendingInterest({
          label: "Вкъщи",
          color: DEFAULT_ZONE_COLOR,
        });
      });

      await waitFor(() => {
        expect(toastMock.error).toHaveBeenCalledWith(
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
      expect(result.current.targetMode).toEqual(
        expect.objectContaining({
          active: true,
          initialRadius: 500,
          editingInterestId: null,
        }),
      );

      // Save interest
      act(() => {
        result.current.handleSaveInterest({ lat: 42.7, lng: 23.3 }, 500);
      });

      expect(result.current.pendingNewInterest).toEqual({
        coordinates: { lat: 42.7, lng: 23.3 },
        radius: 500,
      });

      act(() => {
        result.current.handleConfirmPendingInterest({
          label: "Вкъщи",
          color: DEFAULT_ZONE_COLOR,
        });
      });

      await waitFor(() => {
        expect(result.current.targetMode.active).toBe(false);
      });

      await waitFor(() => {
        expect(addInterest).toHaveBeenCalledWith(
          { lat: 42.7, lng: 23.3 },
          500,
          { label: "Вкъщи", color: DEFAULT_ZONE_COLOR },
        );
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
