"use client";

import PromptCard from "../PromptCard";
import NoNotificationsIcon from "@/components/icons/NoNotificationsIcon";
import { zIndex } from "@/lib/colors";

/**
 * Shown when browser/OS has notifications disabled (issue #32).
 * This is a final state with no actions - users must enable notifications
 * in browser settings to proceed.
 */
export default function BlockedNotificationsPrompt() {
  return (
    <div className={`animate-fade-in fixed inset-0 flex items-center justify-center p-4 ${zIndex.modalContent} pointer-events-none`}>
      <div className="pointer-events-auto w-full max-w-sm">
        <PromptCard
          icon={<NoNotificationsIcon className="w-12 h-12 text-warning" />}
          title="Известията са блокирани"
          description="Браузърът или устройството ти не позволява известия. Можеш да ги включиш от настройките на браузъра."
        />
      </div>
    </div>
  );
}
