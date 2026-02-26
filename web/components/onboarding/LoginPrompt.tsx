"use client";

import { useCallback } from "react";
import { trackEvent } from "@/lib/analytics";
import PromptCard from "../PromptCard";
import { useAuth } from "@/lib/auth-context";
import BellIcon from "@/components/icons/BellIcon";
import { zIndex } from "@/lib/colors";

interface LoginPromptProps {
  /** Called when user clicks "Later" */
  readonly onDismiss: () => void;
}

/**
 * Prompt for unauthenticated users to log in
 * Fully controlled by parent via onDismiss prop
 */
export default function LoginPrompt({ onDismiss }: LoginPromptProps) {
  const { signInWithGoogle } = useAuth();

  const handleLogin = useCallback(() => {
    trackEvent({ name: "login_initiated", params: { source: "prompt" } });
    signInWithGoogle();
  }, [signInWithGoogle]);

  const handleClose = useCallback(() => {
    trackEvent({ name: "login_prompt_dismissed", params: {} });
    onDismiss();
  }, [onDismiss]);

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className={`fixed inset-0 ${zIndex.modalBackdrop} bg-black/20 backdrop-blur-sm pointer-events-auto`}
        onClick={handleClose}
        aria-label="Затвори"
      />
      <div className={`animate-fade-in fixed inset-0 flex items-center justify-center p-4 ${zIndex.modalContent} pointer-events-none`}>
        <div className="pointer-events-auto w-full max-w-sm">
          <PromptCard
            icon={<BellIcon className="w-12 h-12 text-primary" />}
            title="Следи местните съобщения"
            description="Влез, абонирай се и получавай известия, когато има съобщения за зоните, които те интересуват."
            primaryButton={{
              text: "Влез с Google",
              onClick: handleLogin,
            }}
            secondaryButton={{
              text: "По-късно",
              onClick: handleClose,
            }}
          />
        </div>
      </div>
    </>
  );
}
