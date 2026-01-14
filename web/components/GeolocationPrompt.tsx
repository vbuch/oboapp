"use client";

import { trackEvent } from "@/lib/analytics";
import PromptCard from "./PromptCard";

interface GeolocationPromptProps {
  readonly onAccept: () => void;
  readonly onDecline: () => void;
}

export default function GeolocationPrompt({
  onAccept,
  onDecline,
}: GeolocationPromptProps) {
  const handleAccept = () => {
    trackEvent({
      name: "geolocation_prompt_accepted",
      params: {},
    });
    onAccept();
  };

  const handleDecline = () => {
    trackEvent({
      name: "geolocation_prompt_declined",
      params: {},
    });
    onDecline();
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <PromptCard
        icon={
          <svg
            className="w-12 h-12 text-primary"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M22 12h-4M6 12H2M12 6V2M12 18v4" />
          </svg>
        }
        title="Покажи местоположението ми"
        description="Искаш ли да центрираме картата на текущото ти местоположение?"
        note="Няма да го използваме за нищо друго. Можеш да забраниш достъпа до него по всяко време в настройките на браузъра."
        primaryButton={{
          text: "Разреши достъп",
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
