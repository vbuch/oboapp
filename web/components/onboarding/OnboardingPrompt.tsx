"use client";

import AddInterestsPrompt from "./AddInterestsPrompt";
import NotificationPrompt from "./NotificationPrompt";
import BlockedNotificationsPrompt from "./BlockedNotificationsPrompt";
import LoginPrompt from "./LoginPrompt";
import { OnboardingState } from "@/lib/hooks/useOnboardingFlow";
import { User } from "firebase/auth";

interface OnboardingPromptProps {
  readonly state: OnboardingState;
  readonly targetModeActive: boolean;
  readonly user: User | null;
  readonly onPermissionResult: (permission: NotificationPermission) => void;
  readonly onDismiss: () => void;
  readonly onAddInterests: () => void;
  readonly onAddInterestClick: () => void;
}

/**
 * Renders the appropriate onboarding UI based on state machine state.
 * Hidden during target mode (zone creation/editing).
 * 
 * NOTE: Only renders modal prompts with backdrops (notificationPrompt, loginPrompt, etc.).
 * Button-only states (idle, complete, loading) are rendered in MapContainer for proper positioning.
 */
export default function OnboardingPrompt({
  state,
  targetModeActive,
  user,
  onPermissionResult,
  onDismiss,
  onAddInterests,
  onAddInterestClick,
}: OnboardingPromptProps) {
  // Hide all prompts during target mode
  if (targetModeActive) {
    return null;
  }

  switch (state) {
    // Modal states with backdrops - rendered at root level
    case "notificationPrompt":
      return (
        <NotificationPrompt
          onPermissionResult={onPermissionResult}
          onDismiss={onDismiss}
        />
      );

    case "blocked":
      return <BlockedNotificationsPrompt />;

    case "loginPrompt":
      return <LoginPrompt onDismiss={onDismiss} />;

    case "zoneCreation":
      return (
        <AddInterestsPrompt
          onAddInterests={onAddInterests}
          onDismiss={onDismiss}
        />
      );

    // Button-only states - rendered in MapContainer, not here
    case "loading":
    case "idle":
    case "complete":
      return null;

    default:
      return null;
  }
}
