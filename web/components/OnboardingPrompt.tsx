"use client";

import AddInterestButton from "@/components/AddInterestButton";
import AddInterestsPrompt from "@/components/AddInterestsPrompt";
import NotificationPrompt from "@/components/NotificationPrompt";
import BlockedNotificationsPrompt from "@/components/BlockedNotificationsPrompt";
import LoginPrompt from "@/components/LoginPrompt";
import SubscribePrompt from "@/components/SubscribePrompt";
import { OnboardingState } from "@/lib/hooks/useOnboardingFlow";

interface OnboardingPromptProps {
  readonly state: OnboardingState;
  readonly targetModeActive: boolean;
  readonly user: any;
  readonly onPermissionResult: (permission: NotificationPermission) => void;
  readonly onDismiss: () => void;
  readonly onAddInterests: () => void;
  readonly onAddInterestClick: () => void;
}

/**
 * Renders the appropriate onboarding UI based on state machine state.
 * Hidden during target mode (zone creation/editing).
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
    case "loading":
      return null;

    case "notificationPrompt":
      return (
        <NotificationPrompt
          onPermissionResult={onPermissionResult}
          onDismiss={onDismiss}
        />
      );

    case "blocked":
      return <BlockedNotificationsPrompt onDismiss={onDismiss} />;

    case "loginPrompt":
      return <LoginPrompt onDismiss={onDismiss} />;

    case "zoneCreation":
      return (
        <AddInterestsPrompt
          onAddInterests={onAddInterests}
          onDismiss={onDismiss}
        />
      );

    case "subscribePrompt":
      return <SubscribePrompt onClose={onDismiss} />;

    case "idle":
    case "complete":
      return (
        <AddInterestButton
          onClick={onAddInterestClick}
          isUserAuthenticated={!!user}
          visible={true}
        />
      );

    default:
      return null;
  }
}
