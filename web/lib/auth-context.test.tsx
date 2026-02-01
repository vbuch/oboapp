import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth-context";
import type { Auth, User, UserCredential } from "firebase/auth";

// Mock Firebase Auth
vi.mock("./firebase", () => ({
  auth: {} as Auth,
}));

vi.mock("./browser-detection", () => ({
  shouldUseRedirectAuth: vi.fn(() => false), // Default to popup mode
}));

vi.mock("firebase/auth", async () => {
  const actual =
    await vi.importActual<typeof import("firebase/auth")>("firebase/auth");
  return {
    ...actual,
    onAuthStateChanged: vi.fn((auth, callback) => {
      callback(null);
      return vi.fn();
    }),
    signInWithPopup: vi.fn(),
    signInWithRedirect: vi.fn(),
    getRedirectResult: vi.fn(() => Promise.resolve(null)),
    GoogleAuthProvider: vi.fn(),
    signOut: vi.fn(),
  };
});

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("signInWithGoogle", () => {
    it("should use popup mode by default", async () => {
      const { signInWithPopup, signInWithRedirect } =
        await import("firebase/auth");
      const mockSignInWithPopup = signInWithPopup as ReturnType<typeof vi.fn>;
      const mockSignInWithRedirect = signInWithRedirect as ReturnType<
        typeof vi.fn
      >;

      mockSignInWithPopup.mockResolvedValueOnce({} as UserCredential);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.signInWithGoogle();

      expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
      expect(mockSignInWithRedirect).not.toHaveBeenCalled();
    });

    it("should use redirect mode on Safari iOS", async () => {
      const { shouldUseRedirectAuth } = await import("./browser-detection");
      const mockShouldUseRedirectAuth = shouldUseRedirectAuth as ReturnType<
        typeof vi.fn
      >;
      mockShouldUseRedirectAuth.mockReturnValueOnce(true);

      const { signInWithPopup, signInWithRedirect } =
        await import("firebase/auth");
      const mockSignInWithPopup = signInWithPopup as ReturnType<typeof vi.fn>;
      const mockSignInWithRedirect = signInWithRedirect as ReturnType<
        typeof vi.fn
      >;

      mockSignInWithRedirect.mockResolvedValueOnce(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.signInWithGoogle();

      expect(mockSignInWithRedirect).toHaveBeenCalledTimes(1);
      expect(mockSignInWithPopup).not.toHaveBeenCalled();
    });

    it("should not throw error when user closes the popup", async () => {
      const { signInWithPopup } = await import("firebase/auth");
      const mockSignInWithPopup = signInWithPopup as ReturnType<typeof vi.fn>;

      // Simulate user closing the popup
      mockSignInWithPopup.mockRejectedValueOnce({
        code: "auth/popup-closed-by-user",
        message: "The popup has been closed by the user",
      });

      const consoleSpy = vi.spyOn(console, "error");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should not throw when user closes popup
      await expect(result.current.signInWithGoogle()).resolves.toBeUndefined();

      // Should not log error for user cancellation
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should not throw error when popup request is cancelled", async () => {
      const { signInWithPopup } = await import("firebase/auth");
      const mockSignInWithPopup = signInWithPopup as ReturnType<typeof vi.fn>;

      // Simulate cancelled popup request
      mockSignInWithPopup.mockRejectedValueOnce({
        code: "auth/cancelled-popup-request",
        message: "The popup request has been cancelled",
      });

      const consoleSpy = vi.spyOn(console, "error");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should not throw when popup is cancelled
      await expect(result.current.signInWithGoogle()).resolves.toBeUndefined();

      // Should not log error for user cancellation
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should throw error for actual authentication failures", async () => {
      const { signInWithPopup } = await import("firebase/auth");
      const mockSignInWithPopup = signInWithPopup as ReturnType<typeof vi.fn>;

      // Simulate actual authentication error
      mockSignInWithPopup.mockRejectedValueOnce({
        code: "auth/network-request-failed",
        message: "Network request failed",
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should throw for actual errors
      await expect(result.current.signInWithGoogle()).rejects.toMatchObject({
        code: "auth/network-request-failed",
      });
    });

    it("should successfully sign in when popup completes", async () => {
      const { signInWithPopup } = await import("firebase/auth");
      const mockSignInWithPopup = signInWithPopup as ReturnType<typeof vi.fn>;

      const mockUserCredential: UserCredential = {
        user: {
          uid: "test-user-id",
          email: "test@example.com",
          displayName: "Test User",
        } as User,
      } as UserCredential;

      mockSignInWithPopup.mockResolvedValueOnce(mockUserCredential);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should successfully complete
      await expect(result.current.signInWithGoogle()).resolves.toBeUndefined();
    });
  });

  describe("reauthenticateWithGoogle", () => {
    it("should not throw error when user closes the popup during reauthentication", async () => {
      const { onAuthStateChanged } = await import("firebase/auth");
      const mockOnAuthStateChanged = onAuthStateChanged as ReturnType<
        typeof vi.fn
      >;

      // Mock user being logged in
      const mockUser = {
        uid: "test-user-id",
        email: "test@example.com",
      } as User;

      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser);
        return vi.fn();
      });

      // Mock reauthenticateWithPopup dynamically
      vi.doMock("firebase/auth", async () => {
        const actual =
          await vi.importActual<typeof import("firebase/auth")>("firebase/auth");
        return {
          ...actual,
          reauthenticateWithPopup: vi.fn().mockRejectedValue({
            code: "auth/popup-closed-by-user",
            message: "The popup has been closed by the user",
          }),
        };
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should not throw when user closes popup
      await expect(
        result.current.reauthenticateWithGoogle(),
      ).resolves.toBeUndefined();
    });
  });
});
