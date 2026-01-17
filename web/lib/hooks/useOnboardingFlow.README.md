# useOnboardingFlow Hook

State machine hook for managing the user onboarding and engagement flow.

## Overview

This hook centralizes the onboarding UX logic for all users, guiding them through:

1. Notification permission prompt (unauthenticated users)
2. Login
3. Zone creation
4. Push notification subscription

**Unauthenticated Users:** Land in `idle` state (showing only AddInterestButton).
This keeps the UI clean and unobtrusive. The onboarding flow starts when the user
clicks the button, which dispatches `RESTART` and shows the `NotificationPrompt`.

**Authenticated Users:** Land in the appropriate state based on their progress
(`zoneCreation`, `subscribePrompt`, or `complete`).

## State Machine Diagram

```mermaid
stateDiagram-v2
    [*] --> loading

    loading --> idle : LOADED [permission=default, !user]
    loading --> blocked : LOADED [permission=denied]
    loading --> loginPrompt : LOADED [permission=granted OR noAPI, !user]
    loading --> zoneCreation : LOADED [user, zones=0]
    loading --> subscribePrompt : LOADED [user, zones>0, !hasSubs]
    loading --> complete : LOADED [user, zones>0, hasSubs]

    notificationPrompt --> blocked : PERMISSION_RESULT [denied]
    notificationPrompt --> loginPrompt : PERMISSION_RESULT [granted]
    notificationPrompt --> idle : DISMISS

    blocked --> zoneCreation : RE_EVALUATE [user logged in, zones=0]
    blocked --> subscribePrompt : RE_EVALUATE [user logged in, zones>0, !hasSubs]
    blocked --> complete : RE_EVALUATE [user logged in, zones>0, hasSubs]
    blocked --> idle : DISMISS

    loginPrompt --> idle : DISMISS
    loginPrompt --> zoneCreation : RE_EVALUATE [user, zones=0]
    loginPrompt --> subscribePrompt : RE_EVALUATE [user, zones>0, !hasSubs]
    loginPrompt --> complete : RE_EVALUATE [user, zones>0, hasSubs]

    zoneCreation --> subscribePrompt : RE_EVALUATE [zones>0, !hasSubs, permission!=denied]
    zoneCreation --> complete : RE_EVALUATE [zones>0, hasSubs]
    zoneCreation --> complete : RE_EVALUATE [zones>0, permission=denied]
    zoneCreation --> idle : DISMISS

    subscribePrompt --> complete : RE_EVALUATE [hasSubs]
    subscribePrompt --> idle : DISMISS

    idle --> notificationPrompt : RESTART [permission=default, !user]
    idle --> loginPrompt : RESTART [permission!=default OR noAPI, !user]
    idle --> zoneCreation : RESTART [user, zones=0]
    idle --> subscribePrompt : RESTART [user, zones>0, !hasSubs, permission!=denied]
    idle --> complete : RESTART [user, zones>0, hasSubs]
    idle --> complete : RESTART [user, zones>0, permission=denied]

    complete --> [*]
```

## States

| State                | Description                                                     | UI Shown                   |
| -------------------- | --------------------------------------------------------------- | -------------------------- |
| `loading`            | Initial state while checking subscriptions                      | None (loading indicator)   |
| `notificationPrompt` | Ask user about notifications before login                       | NotificationPrompt         |
| `blocked`            | Notifications blocked at browser/OS level                       | BlockedNotificationsPrompt |
| `loginPrompt`        | Ask user to log in                                              | LoginPrompt                |
| `zoneCreation`       | User logged in but has no zones                                 | AddInterestsPrompt         |
| `subscribePrompt`    | User has zones but no push subscriptions                        | SubscribePrompt            |
| `complete`           | Fully onboarded                                                 | AddInterestButton          |
| `idle`               | Initial state for unauthenticated users, or user dismissed flow | AddInterestButton          |

## Actions

| Action              | Description               | Valid From           |
| ------------------- | ------------------------- | -------------------- |
| `LOADED`            | Initial load with context | `loading`            |
| `PERMISSION_RESULT` | Browser permission result | `notificationPrompt` |

| `DISMISS` | User dismissed current prompt | Most states |
| `RESTART` | Re-enter flow from idle | `idle` |
| `RE_EVALUATE` | External state changed (user, zones, subs) | All except `idle` |

## Usage

```tsx
const { state, handlePermissionResult, handleDismiss, handleRestart } =
  useOnboardingFlow({
    user,
    interests,
    subscriptionsLoaded,
    hasSubscriptions,
  });

// Render based on state
switch (state) {
  case "loading":
    return null; // Or loading indicator
  case "notificationPrompt":
    return (
      <NotificationPrompt
        onPermissionResult={handlePermissionResult}
        onDismiss={handleDismiss}
      />
    );
  case "blocked":
    return <BlockedNotificationsPrompt onDismiss={handleDismiss} />;
  case "loginPrompt":
    return <LoginPrompt onDismiss={handleDismiss} />;
  case "zoneCreation":
    return (
      <AddInterestsPrompt
        onAddInterests={startTargetMode}
        onDismiss={handleDismiss}
      />
    );
  case "subscribePrompt":
    return <SubscribePrompt onClose={handleDismiss} />;
  case "idle":
  case "complete":
    return (
      <AddInterestButton
        onClick={state === "idle" ? handleRestart : startTargetMode}
      />
    );
}
```
