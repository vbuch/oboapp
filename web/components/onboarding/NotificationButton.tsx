"use client";

import { trackEvent } from "@/lib/analytics";
import { borderRadius, zIndex } from "@/lib/colors";
import { buttonStyles, buttonSizes } from "@/lib/theme";
import BellIcon from "@/components/icons/BellIcon";

interface NotificationButtonProps {
  readonly onClick: () => void;
  readonly visible?: boolean;
}

/**
 * Button shown to unauthenticated users in idle state to start onboarding flow.
 * Displays "Получавай известия" with a bell icon.
 */
export default function NotificationButton({
  onClick,
  visible = true,
}: NotificationButtonProps) {
  const handleClick = () => {
    trackEvent({
      name: "onboarding_notification_clicked",
      params: {},
    });
    onClick();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`animate-fade-in absolute bottom-8 right-8 ${zIndex.fixed} ${
        buttonSizes.lg
      } ${buttonStyles.primary} ${
        borderRadius.md
      } shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 font-medium ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      aria-label="Получавай известия"
      aria-hidden={!visible}
    >
      <BellIcon className="w-5 h-5" />
      Получавай известия
    </button>
  );
}
