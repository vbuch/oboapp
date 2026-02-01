"use client";

import { useEffect, useState, useCallback } from "react";

type DragDirection = "horizontal" | "vertical";

interface UseDragPanelOptions {
  /** Axis of drag: 'horizontal' (X) or 'vertical' (Y) */
  direction: DragDirection;

  /** Current open state of the panel - used for bidirectional offset clamping */
  isOpen: boolean;

  /** Called when drag threshold is met */
  onAction: () => void;

  /** Threshold in pixels to trigger action (default: 100) */
  threshold?: number;

  /**
   * If true, allows dragging in opposite direction based on isOpen state:
   * - Horizontal: open → drag left to close, closed → drag right to open
   * - Vertical: always drag down to close (bidirectional not typically used)
   */
  bidirectional?: boolean;
}

export interface DragHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

interface UseDragPanelReturn {
  /** Whether a drag gesture has started (touch/mouse down) */
  isDragging: boolean;
  /** Whether user has actually moved (isDragging && has moved position) */
  isActuallyDragging: boolean;
  /** Clamped offset in pixels - apply to transform */
  dragOffset: number;
  /** Event handlers to spread on the drag handle element */
  handlers: DragHandlers;
}

/** Minimum drag distance in pixels to distinguish from tap */
const TAP_THRESHOLD = 10;

/**
 * Unified hook for draggable panels with proper mobile touch handling.
 *
 * Fixes mobile issues:
 * - Global touchmove/touchend listeners with { passive: false }
 * - preventDefault on touch move to block page scroll
 * - Direction-aware offset clamping
 * - Tap detection (ignores drags < 10px)
 *
 * @example
 * // Horizontal toggle (CategoryFilterBox)
 * const { dragOffset, handlers } = useDragPanel({
 *   direction: "horizontal",
 *   isOpen,
 *   bidirectional: true,
 *   onAction: onTogglePanel,
 * });
 *
 * @example
 * // Vertical close (MessageDetailView)
 * const { dragOffset, handlers } = useDragPanel({
 *   direction: "vertical",
 *   isOpen: true,
 *   onAction: onClose,
 * });
 */
export function useDragPanel({
  direction,
  isOpen,
  onAction,
  threshold = 100,
  bidirectional = false,
}: UseDragPanelOptions): UseDragPanelReturn {
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragCurrent, setDragCurrent] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isHorizontal = direction === "horizontal";

  // Calculate clamped offset based on direction and isOpen state
  const getDragOffset = useCallback(() => {
    if (dragStart === null || dragCurrent === null || !isDragging) {
      return 0;
    }
    const offset = dragCurrent - dragStart;

    if (isHorizontal) {
      if (bidirectional) {
        // Horizontal bidirectional: clamp based on open state
        if (isOpen) {
          // Open: only allow dragging left (negative offset)
          return Math.min(0, offset);
        }
        // Closed: only allow dragging right (positive offset)
        return Math.max(0, offset);
      }
      // Horizontal unidirectional: only left (close)
      return Math.min(0, offset);
    }
    // Vertical: only allow dragging down (positive offset)
    return Math.max(0, offset);
  }, [dragStart, dragCurrent, isDragging, isHorizontal, isOpen, bidirectional]);

  // Handle drag end - check if threshold met
  const handleDragEnd = useCallback(() => {
    if (dragStart === null || dragCurrent === null) {
      setDragStart(null);
      setDragCurrent(null);
      setIsDragging(false);
      return;
    }

    const rawOffset = dragCurrent - dragStart;
    const absOffset = Math.abs(rawOffset);

    // Ignore taps (minimal movement)
    if (absOffset < TAP_THRESHOLD) {
      setDragStart(null);
      setDragCurrent(null);
      setIsDragging(false);
      return;
    }

    // Check if threshold met in the correct direction
    let shouldTrigger = false;

    if (isHorizontal) {
      if (bidirectional) {
        if (isOpen && rawOffset < -threshold) {
          // Open + dragged left past threshold → close
          shouldTrigger = true;
        } else if (!isOpen && rawOffset > threshold) {
          // Closed + dragged right past threshold → open
          shouldTrigger = true;
        }
      } else {
        // Unidirectional: left only
        if (rawOffset < -threshold) {
          shouldTrigger = true;
        }
      }
    } else {
      // Vertical: down only
      if (rawOffset > threshold) {
        shouldTrigger = true;
      }
    }

    if (shouldTrigger) {
      onAction();
    }

    setDragStart(null);
    setDragCurrent(null);
    setIsDragging(false);
  }, [
    dragStart,
    dragCurrent,
    isHorizontal,
    isOpen,
    bidirectional,
    threshold,
    onAction,
  ]);

  // Touch handlers (React)
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const pos = isHorizontal ? e.touches[0].clientX : e.touches[0].clientY;
      setDragStart(pos);
      setIsDragging(true);
    },
    [isHorizontal],
  );

  // Mouse handler (React)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent text selection
      const pos = isHorizontal ? e.clientX : e.clientY;
      setDragStart(pos);
      setIsDragging(true);
    },
    [isHorizontal],
  );

  // Global event listeners for smooth dragging outside element bounds
  useEffect(() => {
    if (!isDragging) return;

    // Global mouse handlers
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (dragStart === null) return;
      const pos = isHorizontal ? e.clientX : e.clientY;
      setDragCurrent(pos);
    };

    const handleGlobalMouseUp = () => {
      handleDragEnd();
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (dragStart === null) return;
      e.preventDefault(); // Prevent page scroll during drag
      const pos = isHorizontal ? e.touches[0].clientX : e.touches[0].clientY;
      setDragCurrent(pos);
    };

    const handleGlobalTouchEnd = () => {
      handleDragEnd();
    };

    // Register mouse listeners
    document.addEventListener("mousemove", handleGlobalMouseMove);
    document.addEventListener("mouseup", handleGlobalMouseUp);

    // Register touch listeners with passive: false
    document.addEventListener("touchmove", handleGlobalTouchMove, {
      passive: false,
    });
    document.addEventListener("touchend", handleGlobalTouchEnd);

    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
      document.removeEventListener("touchmove", handleGlobalTouchMove);
      document.removeEventListener("touchend", handleGlobalTouchEnd);
    };
  }, [isDragging, dragStart, isHorizontal, handleDragEnd]);

  const dragOffset = getDragOffset();
  const isActuallyDragging =
    isDragging && dragStart !== null && dragCurrent !== null;

  return {
    isDragging,
    isActuallyDragging,
    dragOffset,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: () => {}, // Handled globally with passive: false
      onTouchEnd: () => {}, // Handled globally
      onMouseDown: handleMouseDown,
    },
  };
}
