"use client";

import { useCallback } from "react";
import { trackEvent } from "@/lib/analytics";
import { subscribeToPushNotifications } from "@/lib/notification-service";
import { useAuth } from "@/lib/auth-context";
import PromptCard from "../PromptCard";

interface NotificationPromptProps {
  /** Called with the permission result after browser prompt */
  readonly onPermissionResult: (permission: NotificationPermission) => void;
  /** Called when user clicks "Not now" */
  readonly onDismiss: () => void;
}

/**
 * First-time visitor notification prompt
 * Asks permission and handles FCM registration on success
 */
export default function NotificationPrompt({
  onPermissionResult,
  onDismiss,
}: NotificationPromptProps) {
  const { user } = useAuth();

  const handleAccept = useCallback(async () => {
    trackEvent({
      name: "notification_permission_accepted",
      params: {},
    });

    try {
      // Request browser permission
      const permission = await Notification.requestPermission();

      // If granted and user is logged in, register FCM token
      if (permission === "granted" && user) {
        const idToken = await user.getIdToken();
        await subscribeToPushNotifications(user.uid, idToken);
      }

      onPermissionResult(permission);
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      // Treat errors as denied
      onPermissionResult("denied");
    }
  }, [user, onPermissionResult]);

  const handleDecline = useCallback(() => {
    trackEvent({
      name: "notification_permission_declined",
      params: {},
    });
    onDismiss();
  }, [onDismiss]);

  return (
    <div className="absolute bottom-4 right-4 z-40 max-w-sm">
      <PromptCard
        icon={
          <svg
            className="w-12 h-12 text-primary"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        }
        title="Маркирай зони на картата"
        description="Добави зони на интерес и получавай известия за събития в тях — спиране на вода, ток, ремонти и други."
        note="Ще поискаме разрешение за известия от браузъра."
        primaryButton={{
          text: "Разреши известия",
          onClick: handleAccept,
        }}
        secondaryButton={{
          text: "Не сега",
          onClick: handleDecline,
        }}
      />
    </div>
  );
}
