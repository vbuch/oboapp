import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDragPanel } from "./useDragPanel";

describe("useDragPanel", () => {
  let mockOnAction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnAction = vi.fn();
  });

  describe("horizontal bidirectional", () => {
    it("should clamp offset negative when open", () => {
      const { result } = renderHook(() =>
        useDragPanel({
          direction: "horizontal",
          isOpen: true,
          bidirectional: true,
          onAction: mockOnAction,
        }),
      );

      // Simulate drag - positive offset (right) should be clamped to 0
      act(() => {
        result.current.handlers.onMouseDown({
          preventDefault: vi.fn(),
          clientX: 100,
        } as any);
      });

      // Mock global mousemove
      act(() => {
        const moveEvent = new MouseEvent("mousemove", { clientX: 150 });
        document.dispatchEvent(moveEvent);
      });

      // Positive offset should be clamped to 0 when open
      expect(result.current.dragOffset).toBe(0);

      // Negative offset should pass through
      act(() => {
        const moveEvent = new MouseEvent("mousemove", { clientX: 50 });
        document.dispatchEvent(moveEvent);
      });

      expect(result.current.dragOffset).toBe(-50);
    });

    it("should clamp offset positive when closed", () => {
      const { result } = renderHook(() =>
        useDragPanel({
          direction: "horizontal",
          isOpen: false,
          bidirectional: true,
          onAction: mockOnAction,
        }),
      );

      act(() => {
        result.current.handlers.onMouseDown({
          preventDefault: vi.fn(),
          clientX: 100,
        } as any);
      });

      // Negative offset (left) should be clamped to 0 when closed
      act(() => {
        const moveEvent = new MouseEvent("mousemove", { clientX: 50 });
        document.dispatchEvent(moveEvent);
      });

      expect(result.current.dragOffset).toBe(0);

      // Positive offset should pass through
      act(() => {
        const moveEvent = new MouseEvent("mousemove", { clientX: 150 });
        document.dispatchEvent(moveEvent);
      });

      expect(result.current.dragOffset).toBe(50);
    });

    it("should trigger action when dragging left past threshold while open", () => {
      const { result } = renderHook(() =>
        useDragPanel({
          direction: "horizontal",
          isOpen: true,
          bidirectional: true,
          onAction: mockOnAction,
          threshold: 100,
        }),
      );

      act(() => {
        result.current.handlers.onMouseDown({
          preventDefault: vi.fn(),
          clientX: 200,
        } as any);
      });

      act(() => {
        const moveEvent = new MouseEvent("mousemove", { clientX: 50 });
        document.dispatchEvent(moveEvent);
      });

      act(() => {
        const upEvent = new MouseEvent("mouseup");
        document.dispatchEvent(upEvent);
      });

      expect(mockOnAction).toHaveBeenCalledOnce();
    });

    it("should trigger action when dragging right past threshold while closed", () => {
      const { result } = renderHook(() =>
        useDragPanel({
          direction: "horizontal",
          isOpen: false,
          bidirectional: true,
          onAction: mockOnAction,
          threshold: 100,
        }),
      );

      act(() => {
        result.current.handlers.onMouseDown({
          preventDefault: vi.fn(),
          clientX: 50,
        } as any);
      });

      act(() => {
        const moveEvent = new MouseEvent("mousemove", { clientX: 200 });
        document.dispatchEvent(moveEvent);
      });

      act(() => {
        const upEvent = new MouseEvent("mouseup");
        document.dispatchEvent(upEvent);
      });

      expect(mockOnAction).toHaveBeenCalledOnce();
    });
  });

  describe("vertical unidirectional", () => {
    it("should clamp offset to positive only (down)", () => {
      const { result } = renderHook(() =>
        useDragPanel({
          direction: "vertical",
          isOpen: true,
          onAction: mockOnAction,
        }),
      );

      act(() => {
        result.current.handlers.onMouseDown({
          preventDefault: vi.fn(),
          clientY: 100,
        } as any);
      });

      // Negative offset (up) should be clamped to 0
      act(() => {
        const moveEvent = new MouseEvent("mousemove", { clientY: 50 });
        document.dispatchEvent(moveEvent);
      });

      expect(result.current.dragOffset).toBe(0);

      // Positive offset (down) should pass through
      act(() => {
        const moveEvent = new MouseEvent("mousemove", { clientY: 150 });
        document.dispatchEvent(moveEvent);
      });

      expect(result.current.dragOffset).toBe(50);
    });

    it("should trigger action when dragging down past threshold", () => {
      const { result } = renderHook(() =>
        useDragPanel({
          direction: "vertical",
          isOpen: true,
          onAction: mockOnAction,
          threshold: 100,
        }),
      );

      act(() => {
        result.current.handlers.onMouseDown({
          preventDefault: vi.fn(),
          clientY: 50,
        } as any);
      });

      act(() => {
        const moveEvent = new MouseEvent("mousemove", { clientY: 200 });
        document.dispatchEvent(moveEvent);
      });

      act(() => {
        const upEvent = new MouseEvent("mouseup");
        document.dispatchEvent(upEvent);
      });

      expect(mockOnAction).toHaveBeenCalledOnce();
    });
  });

  describe("tap detection", () => {
    it("should not trigger action for small movements (tap)", () => {
      const { result } = renderHook(() =>
        useDragPanel({
          direction: "vertical",
          isOpen: true,
          onAction: mockOnAction,
          threshold: 100,
        }),
      );

      act(() => {
        result.current.handlers.onMouseDown({
          preventDefault: vi.fn(),
          clientY: 100,
        } as any);
      });

      // Move only 5px (below 10px tap threshold)
      act(() => {
        const moveEvent = new MouseEvent("mousemove", { clientY: 105 });
        document.dispatchEvent(moveEvent);
      });

      act(() => {
        const upEvent = new MouseEvent("mouseup");
        document.dispatchEvent(upEvent);
      });

      expect(mockOnAction).not.toHaveBeenCalled();
    });

    it("should recognize drag for movements above 10px even if below action threshold", () => {
      const { result } = renderHook(() =>
        useDragPanel({
          direction: "vertical",
          isOpen: true,
          onAction: mockOnAction,
          threshold: 100,
        }),
      );

      act(() => {
        result.current.handlers.onMouseDown({
          preventDefault: vi.fn(),
          clientY: 100,
        } as any);
      });

      // Move 50px (above tap threshold but below action threshold)
      act(() => {
        const moveEvent = new MouseEvent("mousemove", { clientY: 150 });
        document.dispatchEvent(moveEvent);
      });

      expect(result.current.isActuallyDragging).toBe(true);

      act(() => {
        const upEvent = new MouseEvent("mouseup");
        document.dispatchEvent(upEvent);
      });

      // Should not trigger action (below threshold)
      expect(mockOnAction).not.toHaveBeenCalled();
    });
  });

  describe("isActuallyDragging flag", () => {
    it("should be false initially", () => {
      const { result } = renderHook(() =>
        useDragPanel({
          direction: "vertical",
          isOpen: true,
          onAction: mockOnAction,
        }),
      );

      expect(result.current.isActuallyDragging).toBe(false);
    });

    it("should be true after movement starts", () => {
      const { result } = renderHook(() =>
        useDragPanel({
          direction: "vertical",
          isOpen: true,
          onAction: mockOnAction,
        }),
      );

      act(() => {
        result.current.handlers.onMouseDown({
          preventDefault: vi.fn(),
          clientY: 100,
        } as any);
      });

      act(() => {
        const moveEvent = new MouseEvent("mousemove", { clientY: 150 });
        document.dispatchEvent(moveEvent);
      });

      expect(result.current.isActuallyDragging).toBe(true);
    });

    it("should be false after drag ends", () => {
      const { result } = renderHook(() =>
        useDragPanel({
          direction: "vertical",
          isOpen: true,
          onAction: mockOnAction,
        }),
      );

      act(() => {
        result.current.handlers.onMouseDown({
          preventDefault: vi.fn(),
          clientY: 100,
        } as any);
      });

      act(() => {
        const moveEvent = new MouseEvent("mousemove", { clientY: 150 });
        document.dispatchEvent(moveEvent);
      });

      act(() => {
        const upEvent = new MouseEvent("mouseup");
        document.dispatchEvent(upEvent);
      });

      expect(result.current.isActuallyDragging).toBe(false);
    });
  });
});
