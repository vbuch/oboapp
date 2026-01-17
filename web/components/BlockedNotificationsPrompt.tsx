"use client";

import { useCallback } from "react";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/lib/auth-context";
import PromptCard from "./PromptCard";

interface BlockedNotificationsPromptProps {
  readonly onDismiss: () => void;
}

/**
 * Shown when browser/OS has notifications disabled (issue #32)
 * Primary action is to log in directly, secondary is to continue browsing
 */
export default function BlockedNotificationsPrompt({
  onDismiss,
}: BlockedNotificationsPromptProps) {
  const { signInWithGoogle } = useAuth();

  const handleLogin = useCallback(() => {
    trackEvent({
      name: "blocked_notifications_login_clicked",
      params: {},
    });
    signInWithGoogle();
  }, [signInWithGoogle]);

  const handleDismiss = () => {
    trackEvent({
      name: "blocked_notifications_dismissed",
      params: {},
    });
    onDismiss();
  };

  return (
    <div className="absolute bottom-4 right-4 z-40 max-w-sm">
      <PromptCard
        icon={
          <svg
            className="w-12 h-12 text-warning"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        }
        title="Известията са блокирани"
        description="Браузърът или устройството ти не позволява известия. Можеш да ги включиш от настройките на браузъра. Междувременно можеш да влезеш и да добавиш зони — известията ще работят на друго устройство."
        primaryButton={{
          text: "Влез в профила си",
          onClick: handleLogin,
        }}
        secondaryButton={{
          text: "Не сега",
          onClick: handleDismiss,
        }}
      />
    </div>
  );
}
