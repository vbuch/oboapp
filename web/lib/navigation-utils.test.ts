import { describe, it, expect, vi, beforeEach } from "vitest";
import { navigateBackOrReplace } from "./navigation-utils";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

describe("navigation-utils", () => {
  describe("navigateBackOrReplace", () => {
    let mockRouter: AppRouterInstance;

    beforeEach(() => {
      mockRouter = {
        back: vi.fn(),
        forward: vi.fn(),
        prefetch: vi.fn(),
        push: vi.fn(),
        refresh: vi.fn(),
        replace: vi.fn(),
      } as unknown as AppRouterInstance;
    });

    it("should call router.back() when history.length > 1", () => {
      // Mock window.history.length
      Object.defineProperty(window, "history", {
        writable: true,
        value: { length: 2 },
      });

      navigateBackOrReplace(mockRouter, "/fallback");

      expect(mockRouter.back).toHaveBeenCalledTimes(1);
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it("should call router.replace() when history.length <= 1", () => {
      // Mock window.history.length
      Object.defineProperty(window, "history", {
        writable: true,
        value: { length: 1 },
      });

      navigateBackOrReplace(mockRouter, "/fallback");

      expect(mockRouter.replace).toHaveBeenCalledWith("/fallback", {
        scroll: false,
      });
      expect(mockRouter.back).not.toHaveBeenCalled();
    });

    it("should call router.replace() when history.length is 0", () => {
      // Mock window.history.length
      Object.defineProperty(window, "history", {
        writable: true,
        value: { length: 0 },
      });

      navigateBackOrReplace(mockRouter, "/custom-fallback");

      expect(mockRouter.replace).toHaveBeenCalledWith("/custom-fallback", {
        scroll: false,
      });
      expect(mockRouter.back).not.toHaveBeenCalled();
    });

    it("should handle different fallback URLs", () => {
      Object.defineProperty(window, "history", {
        writable: true,
        value: { length: 1 },
      });

      navigateBackOrReplace(mockRouter, "/sources/abc123");

      expect(mockRouter.replace).toHaveBeenCalledWith("/sources/abc123", {
        scroll: false,
      });
    });
  });
});
