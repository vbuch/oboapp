"use client";

import { useCallback } from "react";
import { trackEvent } from "@/lib/analytics";
import { subscribeToPushNotifications } from "@/lib/notification-service";
import { useAuth } from "@/lib/auth-context";
import PromptCard from "../PromptCard";
import BellIcon from "@/components/icons/BellIcon";
import { zIndex } from "@/lib/colors";

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
    <>
      {/* Backdrop */}
      <button
        type="button"
        className={`fixed inset-0 ${zIndex.modalBackdrop} bg-black/20 backdrop-blur-sm pointer-events-auto`}
        onClick={handleDecline}
        aria-label="Затвори"
      />
      <div className={`animate-fade-in fixed inset-0 flex items-center justify-center p-4 ${zIndex.modalContent} pointer-events-none`}>
        <div className="pointer-events-auto w-full max-w-sm">
          <PromptCard
            icon={<BellIcon className="w-12 h-12 text-primary" />}
            title="Получавай известия"
            description="Ще поискаме разрешение за известия от браузъра."
            note="След това ще можеш да добавиш зони на интерес и да получаваш известия за събития в тях."
            primaryButton={{
              text: "Разреши известия",
              onClick: () => {
                void handleAccept();
              },
            }}
            secondaryButton={{
              text: "Не сега",
              onClick: handleDecline,
            }}
          />
        </div>
      </div>
    </>
  );
}
