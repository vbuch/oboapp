"use client";

import PromptCard from "../PromptCard";
import NoNotificationsIcon from "@/components/icons/NoNotificationsIcon";

/**
 * Shown when browser/OS has notifications disabled (issue #32).
 * This is a final state with no actions - users must enable notifications
 * in browser settings to proceed.
 */
export default function BlockedNotificationsPrompt() {
  return (
    <div className="animate-fade-in absolute bottom-4 right-4 z-10 max-w-sm">
      <PromptCard
        icon={<NoNotificationsIcon className="w-12 h-12 text-warning" />}
        title="Известията са блокирани"
        description="Браузърът или устройството ти не позволява известия. Можеш да ги включиш от настройките на браузъра."
      />
    </div>
  );
}
