import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isIOS,
  isSafari,
  isPWA,
  getPlatformInfo,
  getNotificationInstructions,
} from "./platform-detection";

describe("platform-detection", () => {
  beforeEach(() => {
    // Reset window object
    vi.stubGlobal("window", {
      navigator: {
        userAgent: "",
        standalone: false,
      },
      matchMedia: vi.fn(),
    });
  });

  describe("isIOS", () => {
    it("should return true for iPhone", () => {
      vi.stubGlobal("window", {
        navigator: {
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        },
      });
      expect(isIOS()).toBe(true);
    });

    it("should return true for iPad", () => {
      vi.stubGlobal("window", {
        navigator: {
          userAgent:
            "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        },
      });
      expect(isIOS()).toBe(true);
    });

    it("should return false for Android", () => {
      vi.stubGlobal("window", {
        navigator: {
          userAgent:
            "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120",
        },
      });
      expect(isIOS()).toBe(false);
    });

    it("should return false for desktop", () => {
      vi.stubGlobal("window", {
        navigator: {
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      expect(isIOS()).toBe(false);
    });
  });

  describe("isSafari", () => {
    it("should return true for Safari on iOS", () => {
      vi.stubGlobal("window", {
        navigator: {
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        },
      });
      expect(isSafari()).toBe(true);
    });

    it("should return true for Safari on macOS", () => {
      vi.stubGlobal("window", {
        navigator: {
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
        },
      });
      expect(isSafari()).toBe(true);
    });

    it("should return false for Chrome", () => {
      vi.stubGlobal("window", {
        navigator: {
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Safari/537.36",
        },
      });
      expect(isSafari()).toBe(false);
    });

    it("should return false for Chrome on iOS (CriOS)", () => {
      vi.stubGlobal("window", {
        navigator: {
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/91.0.4472.80 Mobile/15E148 Safari/604.1",
        },
      });
      expect(isSafari()).toBe(false);
    });
  });

  describe("isPWA", () => {
    it("should return true when in standalone mode (matchMedia)", () => {
      const matchMediaMock = vi.fn((query: string) => ({
        matches: query === "(display-mode: standalone)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }));

      vi.stubGlobal("window", {
        navigator: { userAgent: "" },
        matchMedia: matchMediaMock,
      });

      expect(isPWA()).toBe(true);
    });

    it("should return true when navigator.standalone is true (iOS)", () => {
      vi.stubGlobal("window", {
        navigator: {
          userAgent: "",
          standalone: true,
        },
        matchMedia: vi.fn(() => ({
          matches: false,
          media: "",
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
        })),
      });

      expect(isPWA()).toBe(true);
    });

    it("should return false when not in PWA mode", () => {
      const matchMediaMock = vi.fn(() => ({
        matches: false,
        media: "",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }));

      vi.stubGlobal("window", {
        navigator: {
          userAgent: "",
          standalone: false,
        },
        matchMedia: matchMediaMock,
      });

      expect(isPWA()).toBe(false);
    });
  });

  describe("getPlatformInfo", () => {
    it("should detect iOS Safari in browser mode requiring PWA install", () => {
      const matchMediaMock = vi.fn(() => ({
        matches: false,
        media: "",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }));

      vi.stubGlobal("window", {
        navigator: {
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
          standalone: false,
        },
        matchMedia: matchMediaMock,
      });

      const info = getPlatformInfo();
      expect(info.isIOS).toBe(true);
      expect(info.isSafari).toBe(true);
      expect(info.isIOSSafari).toBe(true);
      expect(info.isPWA).toBe(false);
      expect(info.supportsNotifications).toBe(false);
      expect(info.requiresPWAInstall).toBe(true);
    });

    it("should detect iOS Safari in PWA mode with notifications support", () => {
      const matchMediaMock = vi.fn((query: string) => ({
        matches: query === "(display-mode: standalone)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }));

      vi.stubGlobal("window", {
        navigator: {
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
          standalone: true,
        },
        matchMedia: matchMediaMock,
      });

      const info = getPlatformInfo();
      expect(info.isIOS).toBe(true);
      expect(info.isSafari).toBe(true);
      expect(info.isIOSSafari).toBe(true);
      expect(info.isPWA).toBe(true);
      expect(info.supportsNotifications).toBe(true);
      expect(info.requiresPWAInstall).toBe(false);
    });

    it("should detect Chrome on desktop with notifications support", () => {
      const matchMediaMock = vi.fn(() => ({
        matches: false,
        media: "",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }));

      vi.stubGlobal("window", {
        navigator: {
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120",
          standalone: false,
        },
        matchMedia: matchMediaMock,
      });

      const info = getPlatformInfo();
      expect(info.isIOS).toBe(false);
      expect(info.isSafari).toBe(false);
      expect(info.isIOSSafari).toBe(false);
      expect(info.isPWA).toBe(false);
      expect(info.supportsNotifications).toBe(true);
      expect(info.requiresPWAInstall).toBe(false);
    });
  });

  describe("getNotificationInstructions", () => {
    it("should return iOS PWA install instructions when requiresPWAInstall is true", () => {
      const platformInfo = {
        isIOS: true,
        isSafari: true,
        isIOSSafari: true,
        isPWA: false,
        supportsNotifications: false,
        requiresPWAInstall: true,
      };

      const instructions = getNotificationInstructions(platformInfo);
      expect(instructions).toContain("iOS Safari");
      expect(instructions).toContain("Add to Home Screen");
    });

    it("should return unsupported message when notifications not supported", () => {
      const platformInfo = {
        isIOS: false,
        isSafari: false,
        isIOSSafari: false,
        isPWA: false,
        supportsNotifications: false,
        requiresPWAInstall: false,
      };

      const instructions = getNotificationInstructions(platformInfo);
      expect(instructions).toContain("не поддържа известия");
    });

    it("should return empty string when notifications are supported", () => {
      const platformInfo = {
        isIOS: false,
        isSafari: false,
        isIOSSafari: false,
        isPWA: false,
        supportsNotifications: true,
        requiresPWAInstall: false,
      };

      const instructions = getNotificationInstructions(platformInfo);
      expect(instructions).toBe("");
    });
  });
});
