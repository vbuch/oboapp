import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { debounce } from "./debounce";

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call the callback after the specified delay", () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 300);

    debounced();
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should reset the timer on subsequent calls", () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 300);

    debounced();
    vi.advanceTimersByTime(200);
    debounced();
    vi.advanceTimersByTime(200);

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should pass arguments to the callback", () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 300);

    debounced("arg1", 42);
    vi.advanceTimersByTime(300);

    expect(callback).toHaveBeenCalledWith("arg1", 42);
  });

  it("should only use the last arguments when called multiple times", () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 300);

    debounced("first");
    debounced("second");
    debounced("third");
    vi.advanceTimersByTime(300);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("third");
  });
});
