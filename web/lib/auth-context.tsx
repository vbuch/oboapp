"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  AuthError,
} from "firebase/auth";
import { auth } from "./firebase";

/**
 * Checks if a Firebase Auth error represents user-initiated cancellation
 * (e.g., closing the popup or cancelling the auth request).
 * Returns true if the error should be ignored (not a real error).
 */
function isUserCancellationError(error: unknown): boolean {
  if (error && typeof error === "object" && "code" in error) {
    const authError = error as AuthError;
    return (
      authError.code === "auth/popup-closed-by-user" ||
      authError.code === "auth/cancelled-popup-request"
    );
  }
  return false;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  reauthenticateWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: unknown) {
      // User closing the popup is intentional, not an error
      if (isUserCancellationError(error)) {
        return;
      }
      console.error("Error signing in with Google:", error);
      throw error;
    }
  }, []);

  const reauthenticateWithGoogle = useCallback(async () => {
    if (!user) {
      throw new Error("No user to reauthenticate");
    }
    try {
      const provider = new GoogleAuthProvider();
      const { reauthenticateWithPopup } = await import("firebase/auth");
      await reauthenticateWithPopup(user, provider);
    } catch (error: unknown) {
      // User closing the popup is intentional, not an error
      if (isUserCancellationError(error)) {
        return;
      }
      console.error("Error reauthenticating with Google:", error);
      throw error;
    }
  }, [user]);

  const signOut = useCallback(async () => {
    try {
      // Unsubscribe from push notifications before signing out
      if (user) {
        try {
          const idToken = await user.getIdToken();
          const { unsubscribeOnSignOut } =
            await import("./notification-service");
          await unsubscribeOnSignOut(user.uid, idToken);
        } catch (notifError) {
          // Don't block sign-out if notification cleanup fails
          console.error("Error cleaning up notifications:", notifError);
        }
      }

      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      loading,
      signInWithGoogle,
      reauthenticateWithGoogle,
      signOut,
    }),
    [user, loading, signInWithGoogle, reauthenticateWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
