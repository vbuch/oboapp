import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMessageAnimation } from "./useMessageAnimation";
import { Message } from "@/lib/types";

describe("useMessageAnimation", () => {
  let rafCallbacks: FrameRequestCallback[] = [];
  let rafId = 0;

  beforeEach(() => {
    rafCallbacks = [];
    rafId = 0;

    // Mock requestAnimationFrame
    global.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return ++rafId;
    });

    // Mock cancelAnimationFrame
    global.cancelAnimationFrame = vi.fn((id: number) => {
      const index = id - 1;
      if (rafCallbacks[index]) {
        rafCallbacks[index] = () => {}; // Clear the callback
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createMockMessage = (id: string): Message => ({
    id,
    text: "Test message",
    createdAt: new Date().toISOString(),
    locality: "bg.sofia",
    finalizedAt: new Date().toISOString(),
    addresses: [],
  });

  it("should initialize with isVisible as false", () => {
    const { result } = renderHook(() => useMessageAnimation(null));

    expect(result.current).toBe(false);
  });

  it("should remain false when message is null", () => {
    const { result } = renderHook(() => useMessageAnimation(null));

    expect(result.current).toBe(false);
    expect(global.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("should trigger animation when message is provided", async () => {
    const message = createMockMessage("msg-1");
    const { result } = renderHook(() => useMessageAnimation(message));

    // Initially false
    expect(result.current).toBe(false);

    // Execute the requestAnimationFrame callback
    await waitFor(() => {
      expect(global.requestAnimationFrame).toHaveBeenCalled();
      rafCallbacks.forEach((cb) => cb(0));
    });

    // Should now be true
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it("should reset animation when message ID changes", async () => {
    const message1 = createMockMessage("msg-1");
    const initialProps: { msg: Message | null } = { msg: message1 };
    const { result, rerender } = renderHook(
      ({ msg }: { msg: Message | null }) => useMessageAnimation(msg),
      { initialProps },
    );

    // Trigger first animation
    await waitFor(() => {
      expect(global.requestAnimationFrame).toHaveBeenCalled();
      rafCallbacks.forEach((cb) => cb(0));
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    // Clear the RAF callbacks for the next test
    rafCallbacks = [];
    rafId = 0;

    // Change message
    const message2 = createMockMessage("msg-2");
    rerender({ msg: message2 });

    // Should reset to false, then animate back to true
    await waitFor(() => {
      expect(result.current).toBe(false);
    });

    // Execute the new requestAnimationFrame callback
    await waitFor(() => {
      rafCallbacks.forEach((cb) => cb(0));
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it("should not trigger animation when message ID stays the same", async () => {
    const message = createMockMessage("msg-1");
    const initialProps: { msg: Message | null } = { msg: message };
    const { result, rerender } = renderHook(
      ({ msg }: { msg: Message | null }) => useMessageAnimation(msg),
      { initialProps },
    );

    // Trigger initial animation
    await waitFor(() => {
      rafCallbacks.forEach((cb) => cb(0));
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    const callCount = (global.requestAnimationFrame as any).mock.calls.length;

    // Rerender with the same message
    rerender({ msg: message });

    // Should not trigger a new animation
    expect((global.requestAnimationFrame as any).mock.calls.length).toBe(
      callCount,
    );
    expect(result.current).toBe(true);
  });

  it("should handle message changing to null", async () => {
    const message = createMockMessage("msg-1");
    const initialProps: { msg: Message | null } = { msg: message };
    const { result, rerender } = renderHook(
      ({ msg }: { msg: Message | null }) => useMessageAnimation(msg),
      { initialProps },
    );

    // Trigger initial animation
    await waitFor(() => {
      rafCallbacks.forEach((cb) => cb(0));
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    // Change to null
    rerender({ msg: null });

    // Should reset to false
    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("should cancel pending animation frame on cleanup", async () => {
    const message = createMockMessage("msg-1");
    const { unmount } = renderHook(() => useMessageAnimation(message));

    await waitFor(() => {
      expect(global.requestAnimationFrame).toHaveBeenCalled();
    });

    // Unmount before RAF callback executes
    unmount();

    // Should have called cancelAnimationFrame
    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });

  it("should handle rapid message changes correctly", async () => {
    const message1 = createMockMessage("msg-1");
    const message2 = createMockMessage("msg-2");
    const message3 = createMockMessage("msg-3");
    const initialProps: { msg: Message | null } = { msg: message1 };

    const { result, rerender } = renderHook(
      ({ msg }: { msg: Message | null }) => useMessageAnimation(msg),
      { initialProps },
    );

    // Rapidly change messages
    rerender({ msg: message2 });
    rerender({ msg: message3 });

    // Should eventually settle on false (reset state)
    await waitFor(() => {
      expect(result.current).toBe(false);
    });

    // Execute RAF callbacks
    await waitFor(() => {
      rafCallbacks.forEach((cb) => cb(0));
    });

    // Should animate to true for the latest message
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });
});
