import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isSafariMobile,
  isEdge,
  shouldUseRedirectAuth,
} from "./browser-detection";

describe("browser-detection", () => {
  const originalNavigator = global.navigator;

  beforeEach(() => {
    // Reset navigator mock before each test
    vi.stubGlobal("navigator", originalNavigator);
  });

  describe("isSafariMobile", () => {
    it("should return true for iPhone Safari", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      });
      expect(isSafariMobile()).toBe(true);
    });

    it("should return true for iPad Safari", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      });
      expect(isSafariMobile()).toBe(true);
    });

    it("should return false for Chrome on iOS", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/108.0.5359.112 Mobile/15E148 Safari/604.1",
      });
      expect(isSafariMobile()).toBe(false);
    });

    it("should return false for Firefox on iOS", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/108.0 Mobile/15E148 Safari/605.1.15",
      });
      expect(isSafariMobile()).toBe(false);
    });

    it("should return false for desktop Safari", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
      });
      expect(isSafariMobile()).toBe(false);
    });

    it("should return false for Chrome on desktop", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
      });
      expect(isSafariMobile()).toBe(false);
    });

    it("should return false when navigator is undefined", () => {
      vi.stubGlobal("navigator", undefined);
      expect(isSafariMobile()).toBe(false);
    });
  });

  describe("isEdge", () => {
    it("should return true for Edge on Windows", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
      });
      expect(isEdge()).toBe(true);
    });

    it("should return true for Edge on macOS", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
      });
      expect(isEdge()).toBe(true);
    });

    it("should return true for Edge on Android", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 EdgA/120.0.0.0",
      });
      expect(isEdge()).toBe(true);
    });

    it("should return true for Edge on iOS", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 EdgiOS/120.0.0.0 Mobile/15E148 Safari/605.1.15",
      });
      expect(isEdge()).toBe(true);
    });

    it("should return false for Chrome", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      });
      expect(isEdge()).toBe(false);
    });

    it("should return false for Safari", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
      });
      expect(isEdge()).toBe(false);
    });

    it("should return false when navigator is undefined", () => {
      vi.stubGlobal("navigator", undefined);
      expect(isEdge()).toBe(false);
    });
  });

  describe("shouldUseRedirectAuth", () => {
    it("should return true for iPhone Safari", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      });
      expect(shouldUseRedirectAuth()).toBe(true);
    });

    it("should return true for Android Chrome", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36",
      });
      expect(shouldUseRedirectAuth()).toBe(true);
    });

    it("should return true for iPad Safari", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      });
      expect(shouldUseRedirectAuth()).toBe(true);
    });

    it("should return true for Edge on Windows", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
      });
      expect(shouldUseRedirectAuth()).toBe(true);
    });

    it("should return true for Edge on macOS", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
      });
      expect(shouldUseRedirectAuth()).toBe(true);
    });

    it("should return true for Edge on Android", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 EdgA/120.0.0.0",
      });
      expect(shouldUseRedirectAuth()).toBe(true);
    });

    it("should return false for desktop Chrome", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
      });
      expect(shouldUseRedirectAuth()).toBe(false);
    });

    it("should return false for desktop Safari", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
      });
      expect(shouldUseRedirectAuth()).toBe(false);
    });

    it("should return false for desktop Firefox", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/109.0",
      });
      expect(shouldUseRedirectAuth()).toBe(false);
    });

    it("should return false when navigator is undefined", () => {
      vi.stubGlobal("navigator", undefined);
      expect(shouldUseRedirectAuth()).toBe(false);
    });
  });
});
